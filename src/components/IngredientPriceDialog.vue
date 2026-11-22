<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RecipeIngredient, Unit } from '@/types/recipe'
import type { ProductPrice } from '@/types/prices'
import { searchPrices } from '@/services/priceService'
import { priceState, setIngredientPrice } from '@/stores/prices'
import { unitLabels } from '@/utils/formatIngredient'
import {
  baseAmount,
  formatMoney,
  formatPackage,
  formatPriceDate,
  isOldPrice,
  isPriceDate,
  isProductPrice,
  parseEuroCents,
  priceKey,
  todayDate,
} from '@/utils/recipeCosts'

const props = defineProps<{ item: RecipeIngredient }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const baseUnit = baseAmount(props.item.quantity, props.item.unit).unit
const canSearch = ['GRAM', 'MILLILITER', 'PIECE'].includes(baseUnit)
const mode = ref<'api' | 'manual'>(canSearch ? 'api' : 'manual')

const searchText = ref(props.item.ingredient.name.slice(0, 60))
const lastQuery = ref(searchText.value)
const offers = ref<ProductPrice[]>([])
const page = ref(1)
const hasMore = ref(false)
const isLoading = ref(false)
const hasSearched = ref(false)
const errorMessage = ref('')

let activeRequest: AbortController | null = null
let previousOverflow = ''
let previousGutter = ''

const existing = priceState.prices[priceKey(props.item)]
const productName = ref(existing?.productName ?? props.item.ingredient.name)

const packageQuantity = ref<number | ''>(
  existing?.packageQuantity ?? (baseUnit === 'GRAM' || baseUnit === 'MILLILITER' ? 1000 : 1),
)

const packageUnit = ref<Unit>(existing?.packageUnit ?? baseUnit)
const priceText = ref(existing ? String(existing.priceCents / 100).replace('.', ',') : '')
const shop = ref(existing?.shop ?? '')
const priceDate = ref(existing?.priceDate ?? todayDate())

const compatibleUnits = computed<Unit[]>(() => {
  if (baseUnit === 'GRAM') return ['GRAM', 'KILOGRAM']
  if (baseUnit === 'MILLILITER') return ['MILLILITER', 'LITER']
  return [baseUnit]
})

function changeMode(value: 'api' | 'manual'): void {
  activeRequest?.abort()
  isLoading.value = false
  errorMessage.value = ''
  mode.value = value
}

async function loadPrices(nextPage = 1, query = searchText.value): Promise<void> {
  const term = query.trim()

  if (term.length < 2 || term.length > 60) {
    errorMessage.value = 'Bitte einen Suchbegriff mit 2 bis 60 Zeichen eingeben.'
    return
  }

  activeRequest?.abort()

  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  errorMessage.value = ''
  offers.value = []

  try {
    const result = await searchPrices(term, baseUnit, nextPage, controller.signal)

    if (controller.signal.aborted) return

    offers.value = result.offers
      .filter(isProductPrice)
      .filter((price) => baseAmount(price.packageQuantity, price.packageUnit).unit === baseUnit)

    page.value = result.page
    hasMore.value = result.hasMore
    lastQuery.value = term
    hasSearched.value = true
  } catch (error) {
    if (controller.signal.aborted) return

    console.error('Preissuche fehlgeschlagen:', error)

    errorMessage.value =
      'Die Preise konnten nicht geladen werden. Versuche es erneut oder gib einen eigenen Preis ein.'
  } finally {
    if (!controller.signal.aborted) isLoading.value = false
  }
}

function choose(price: ProductPrice): void {
  setIngredientPrice(props.item, price)
  emit('close')
}

function saveManual(): void {
  const cents = parseEuroCents(priceText.value)

  if (
    cents === null ||
    typeof packageQuantity.value !== 'number' ||
    !Number.isFinite(packageQuantity.value) ||
    packageQuantity.value <= 0 ||
    packageQuantity.value > 1_000_000_000 ||
    (packageUnit.value === 'PIECE' && !Number.isInteger(packageQuantity.value)) ||
    !productName.value.trim() ||
    !isPriceDate(priceDate.value)
  ) {
    errorMessage.value =
      'Bitte Produkt, gültigen Packungsinhalt, Preis mit höchstens zwei Nachkommastellen und ein gültiges Datum angeben.'
    return
  }

  choose({
    priceId: null,
    productId: null,
    productName: productName.value.trim(),
    packageQuantity: packageQuantity.value,
    packageUnit: packageUnit.value,
    priceCents: cents,
    currency: 'EUR',
    shop: shop.value.trim() || 'Eigener Preis',
    city: null,
    priceDate: priceDate.value,
    source: 'MANUAL',
  })
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  previousGutter = document.documentElement.style.scrollbarGutter

  document.documentElement.style.scrollbarGutter = 'stable'
  document.body.style.overflow = 'hidden'

  dialog.value?.showModal()

  if (canSearch) void loadPrices()
})

onBeforeUnmount(() => {
  activeRequest?.abort()
  dialog.value?.close()

  document.body.style.overflow = previousOverflow
  document.documentElement.style.scrollbarGutter = previousGutter
})
</script>

<template>
  <dialog
    ref="dialog"
    class="price-dialog"
    aria-labelledby="price-dialog-title"
    @cancel.prevent="emit('close')"
  >
    <header class="price-dialog-header">
      <h2 id="price-dialog-title">Preis für {{ item.ingredient.name }}</h2>

      <button
        type="button"
        class="price-close"
        aria-label="Preisauswahl schließen"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <div class="price-tabs">
      <button
        v-if="canSearch"
        type="button"
        class="price-button secondary"
        :aria-pressed="mode === 'api'"
        @click="changeMode('api')"
      >
        Preise suchen
      </button>

      <button
        type="button"
        class="price-button secondary"
        :aria-pressed="mode === 'manual'"
        @click="changeMode('manual')"
      >
        Eigenen Preis eingeben
      </button>
    </div>

    <template v-if="mode === 'api'">
      <p class="price-hint">
        In Deutschland erfasste Normalpreise in Euro. Prüfe Produkt, Händler und Datum vor der
        Auswahl.
      </p>

      <form @submit.prevent="loadPrices()">
        <label>
          Produkt suchen
          <input
            v-model="searchText"
            class="price-search-input"
            type="search"
            minlength="2"
            maxlength="60"
            required
            autofocus
          />
        </label>

        <button type="submit" class="price-button" :disabled="isLoading">Suchen</button>
      </form>

      <p v-if="isLoading" role="status">Preise werden geladen …</p>

      <p v-else-if="hasSearched && !offers.length && !errorMessage" class="price-hint">
        Keine passenden Packungspreise in diesen Ergebnissen. Du kannst weitere Produkte ansehen
        oder einen eigenen Preis eingeben.
      </p>

      <ul class="price-results">
        <li v-for="offer in offers" :key="offer.priceId ?? offer.productName">
          <button type="button" class="price-offer" @click="choose(offer)">
            <strong>{{ offer.productName }}</strong>

            <span>
              {{ formatPackage(offer) }} · {{ formatMoney(offer.priceCents) }} pro Packung
            </span>

            <span>
              {{ offer.shop }}{{ offer.city ? `, ${offer.city}` : '' }} ·
              {{ formatPriceDate(offer.priceDate) }}
            </span>

            <span v-if="isOldPrice(offer.priceDate)" class="price-old">
              Preiseintrag älter als 90 Tage
            </span>

            <span class="price-select-label">Diesen Preis verwenden</span>
          </button>
        </li>
      </ul>

      <div v-if="hasSearched && (page > 1 || hasMore)" class="price-pagination">
        <button
          type="button"
          class="price-button secondary"
          :disabled="page <= 1 || isLoading"
          @click="loadPrices(page - 1, lastQuery)"
        >
          Zurück
        </button>

        <span>Produktseite {{ page }}</span>

        <button
          type="button"
          class="price-button secondary"
          :disabled="!hasMore || isLoading"
          @click="loadPrices(page + 1, lastQuery)"
        >
          Weitere Produkte
        </button>
      </div>

      <p class="price-hint">
        Preisdaten:
        <a href="https://prices.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">
          Open Prices / Open Food Facts
        </a>
        · ODbL. Die erfassten Preise sind keine Zusage für den heutigen Ladenpreis.
      </p>
    </template>

    <form v-else class="manual-price-form" @submit.prevent="saveManual">
      <p v-if="!canSearch" class="price-hint">
        Für diese Einheit kannst du einen eigenen Preis pro Packung oder Bezugsmenge angeben. Eine
        Umrechnung zwischen Gewicht und Löffeln wird nicht geschätzt.
      </p>

      <label>
        Produkt
        <input v-model="productName" class="manual-product" maxlength="240" required />
      </label>

      <label>
        Packungsinhalt / Bezugsmenge
        <input
          v-model.number="packageQuantity"
          class="manual-quantity"
          type="number"
          :min="packageUnit === 'PIECE' ? 1 : 0.001"
          max="1000000000"
          :step="packageUnit === 'PIECE' ? 1 : 0.001"
          required
        />
      </label>

      <label>
        Einheit
        <select v-model="packageUnit" class="manual-unit">
          <option v-for="unit in compatibleUnits" :key="unit" :value="unit">
            {{ unitLabels[unit] }}
          </option>
        </select>
      </label>

      <label>
        Preis für diese Packung / Bezugsmenge (€)
        <input
          v-model="priceText"
          class="manual-price"
          type="text"
          inputmode="decimal"
          pattern="[0-9]+([,.][0-9]{1,2})?"
          maxlength="10"
          placeholder="z. B. 1,29"
          required
        />
      </label>

      <label>
        Händler (optional)
        <input v-model="shop" class="manual-shop" maxlength="160" placeholder="z. B. REWE" />
      </label>

      <label>
        Preisdatum
        <input v-model="priceDate" class="manual-date" type="date" :max="todayDate()" required />
      </label>

      <button type="submit" class="price-button">Preis speichern</button>
    </form>

    <p v-if="errorMessage" class="price-error" role="alert">
      {{ errorMessage }}
    </p>
  </dialog>
</template>

<style scoped>
.price-dialog {
  width: min(640px, calc(100% - 32px));
  max-height: calc(100dvh - 40px);
  margin: auto;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  color: #263b32;
  background: white;
  overflow-y: auto;
}

.price-dialog::backdrop {
  background: rgb(20 35 28 / 40%);
  backdrop-filter: blur(5px);
}

.price-dialog-header,
.price-tabs,
.price-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.price-dialog-header {
  justify-content: space-between;
}

.price-dialog h2 {
  margin: 0;
  font-size: 1.4rem;
  overflow-wrap: anywhere;
  flex: 1;
}

.price-close {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  font: 1.7rem Arial;
  cursor: pointer;
}

.price-tabs {
  margin-block: 20px;
}

.price-dialog form,
.price-dialog label {
  display: grid;
  gap: 8px;
}

.price-dialog form {
  gap: 14px;
}

.price-dialog input,
.price-dialog select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
}

.price-button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary);
  color: white;
  font: inherit;
  cursor: pointer;
}

.price-button.secondary {
  color: var(--color-primary);
  background: #f4f7f1;
}

.price-button[aria-pressed='true'] {
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.price-hint {
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

.price-hint a {
  text-decoration: underline;
}

.price-results {
  margin: 20px 0;
  padding: 0;
  list-style: none;
}

.price-results li + li {
  margin-top: 12px;
}

.price-offer {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: white;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.price-offer:hover {
  background: #f5f8f3;
  border-color: var(--color-primary);
}

.price-offer span {
  font-size: 0.9rem;
}

.price-select-label {
  color: var(--color-primary);
  font-weight: 600;
}

.price-old {
  color: #805000;
}

.price-error {
  color: #a52f2f;
  line-height: 1.6;
}
</style>
