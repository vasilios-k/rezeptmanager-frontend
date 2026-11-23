<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import IngredientPriceDialog from '@/components/IngredientPriceDialog.vue'
import type { RecipeIngredient } from '@/types/recipe'
import { priceState, removeIngredientPrice, setIngredientInPantry } from '@/stores/prices'
import { formatIngredientAmount } from '@/utils/formatIngredient'
import {
  calculateCosts,
  formatMoney,
  formatPackage,
  formatPriceDate,
  isOldPrice,
} from '@/utils/recipeCosts'

const props = withDefaults(
  defineProps<{
    ingredients: readonly RecipeIngredient[]
    servings?: number
    shopping?: boolean
  }>(),
  { shopping: false },
)

const editingItem = ref<RecipeIngredient | null>(null)
let returnFocus: HTMLElement | null = null

const rows = computed(() =>
  calculateCosts(props.ingredients, priceState.prices, props.shopping ? priceState.pantry : {}),
)

const pricedCount = computed(() => rows.value.filter((row) => row.consumptionCents !== null).length)

const missingPurchaseCount = computed(
  () => rows.value.filter((row) => row.purchaseCents === null).length,
)

const consumptionTotal = computed(() =>
  pricedCount.value ? rows.value.reduce((sum, row) => sum + (row.consumptionCents ?? 0), 0) : null,
)

const purchaseTotal = computed(() =>
  rows.value.some((row) => row.purchaseCents !== null)
    ? rows.value.reduce((sum, row) => sum + (row.purchaseCents ?? 0), 0)
    : null,
)

const portionCost = computed(() =>
  props.servings && consumptionTotal.value !== null
    ? consumptionTotal.value / props.servings
    : null,
)

function editPrice(item: RecipeIngredient, event: Event): void {
  returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null

  editingItem.value = item
}

async function closeDialog(): Promise<void> {
  editingItem.value = null

  await nextTick()

  if (returnFocus?.isConnected) {
    returnFocus.focus({ preventScroll: true })
  }
}

function markPantry(item: RecipeIngredient, event: Event): void {
  setIngredientInPantry(item, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <section v-if="ingredients.length" class="cost-panel" aria-label="Kostenübersicht">
    <h2>{{ shopping ? 'Kosten für deinen Einkauf' : 'Rezeptkosten' }}</h2>

    <p class="cost-description" role="status">
      {{ pricedCount }} von {{ rows.length }} Zutaten mit Preis
    </p>

    <dl class="cost-summary" aria-live="polite" aria-atomic="true">
      <div>
        <dt>
          {{ pricedCount === rows.length ? 'Geschätzter Zutatenwert' : 'Bekannter Zutatenwert' }}
        </dt>
        <dd class="consumption-total">
          {{ formatMoney(consumptionTotal) }}
        </dd>
      </div>

      <div v-if="servings">
        <dt>
          {{ pricedCount === rows.length ? 'Pro Portion' : 'Bekannter Anteil pro Portion' }}
        </dt>
        <dd class="portion-cost">{{ formatMoney(portionCost) }}</dd>
      </div>

      <div v-if="shopping">
        <dt>
          {{
            missingPurchaseCount ? 'Bekannter Einkaufsbetrag' : 'Voraussichtlicher Einkaufsbetrag'
          }}
        </dt>
        <dd class="purchase-total">{{ formatMoney(purchaseTotal) }}</dd>
      </div>
    </dl>

    <p v-if="pricedCount < rows.length || (shopping && missingPurchaseCount)" class="cost-hint">
      Für eine vollständige Berechnung fehlen noch Preise. Die angezeigten Beträge sind Teilbeträge.
    </p>

    <ul class="cost-rows">
      <li v-for="row in rows" :key="row.key" class="cost-row">
        <div class="cost-row-heading">
          <strong>{{ row.item.ingredient.name }}</strong>

          <span>
            {{ formatIngredientAmount(row.item) }} ·
            <span class="ingredient-cost">
              {{ formatMoney(row.consumptionCents) }}
            </span>
            Zutatenwert
          </span>
        </div>

        <p v-if="row.price" class="cost-product">
          {{ row.price.productName }} · {{ formatPackage(row.price) }} für
          {{ formatMoney(row.price.priceCents) }}<br />

          {{ row.price.shop }}{{ row.price.city ? `, ${row.price.city}` : '' }} · Stand
          {{ formatPriceDate(row.price.priceDate) }} ·
          {{ row.price.source === 'OPEN_PRICES' ? 'Open Prices' : 'Eigene Angabe' }}

          <span v-if="isOldPrice(row.price.priceDate)" class="cost-old"> · älter als 90 Tage </span>
        </p>

        <p v-else class="cost-product">Noch kein passender Packungspreis zugeordnet.</p>

        <p v-if="shopping" class="cost-packs">
          <template v-if="row.inPantry"> Schon vorhanden · kein Einkauf nötig </template>

          <template v-else-if="row.packages !== null && row.price">
            {{ row.packages }}
            {{ row.packages === 1 ? 'Packung' : 'Packungen' }} kaufen ·
            {{ formatMoney(row.purchaseCents) }}
          </template>

          <template v-else> Benötigter Einkaufsbetrag noch offen. </template>
        </p>

        <div class="cost-actions">
          <button type="button" class="cost-edit-price" @click="editPrice(row.item, $event)">
            {{ row.price ? 'Preis ändern' : 'Preis festlegen' }}
          </button>

          <button
            v-if="row.price"
            type="button"
            class="cost-remove-price"
            :aria-label="`Preis für ${row.item.ingredient.name} entfernen`"
            @click="removeIngredientPrice(row.item)"
          >
            Entfernen
          </button>

          <label v-if="shopping" class="cost-pantry-label">
            <input
              type="checkbox"
              class="cost-pantry"
              :checked="row.inPantry"
              @change="markPantry(row.item, $event)"
            />
            Benötigte Menge schon vorhanden
          </label>
        </div>
      </li>
    </ul>

    <p class="cost-hint">
      Der Zutatenwert bezieht sich auf die verbrauchte Menge. Für den Einkauf werden ganze Packungen
      berechnet. Preise können je nach Händler und Datum abweichen.
    </p>

    <p v-if="shopping" class="cost-hint">
      „Schon vorhanden“ gilt für die aktuell benötigte Menge und wird bei einer Mengenänderung
      erneut geprüft.
    </p>

    <p class="cost-hint">
      Deine Preiszuordnungen werden mit deinem Konto synchronisiert und auch bei anderen Rezepten
      verwendet.
    </p>

    <IngredientPriceDialog v-if="editingItem" :item="editingItem" @close="closeDialog" />
  </section>
</template>

<style scoped>
.cost-panel {
  margin-top: 28px;
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: white;
}

.cost-panel h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.7rem;
}

.cost-description,
.cost-hint,
.cost-product {
  color: var(--color-muted);
  line-height: 1.6;
}

.cost-hint,
.cost-product,
.cost-packs {
  font-size: 0.85rem;
}

.cost-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 40px;
  margin-block: 24px;
}

.cost-summary dt {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.cost-summary dd {
  margin: 8px 0 0;
  font-size: 1.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cost-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cost-row {
  padding-block: 20px;
  border-top: 1px solid var(--color-border);
  overflow-wrap: anywhere;
}

.cost-row-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 20px;
}

.cost-row-heading > span,
.cost-product {
  font-size: 0.9rem;
}

.cost-product {
  margin: 12px 0;
}

.cost-packs {
  color: var(--color-primary);
  font-weight: 600;
}

.cost-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
}

.cost-actions button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  color: var(--color-primary);
  background: #f4f7f1;
  font: inherit;
  cursor: pointer;
}

.cost-actions .cost-remove-price {
  border-color: transparent;
  background: transparent;
  text-decoration: underline;
}

.cost-pantry-label {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  font-size: 0.9rem;
  cursor: pointer;
}

.cost-pantry {
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: var(--color-primary);
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.cost-old {
  color: #805000;
}

@media (max-width: 600px) {
  .cost-panel {
    padding: 22px;
  }
}
</style>
