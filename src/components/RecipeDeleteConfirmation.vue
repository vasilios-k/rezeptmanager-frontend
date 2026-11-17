<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { deleteRecipe } from '@/services/recipeService'
import type { Recipe } from '@/types/recipe'

const props = defineProps<{
  recipe: Recipe
}>()

const emit = defineEmits<{
  deleted: [recipe: Recipe]
  cancel: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const isDeleting = ref(false)
const errorMessage = ref('')

let previousScrollStyles: {
  overflow: string
  paddingRight: string
} | null = null

function lockBackgroundScroll(): void {
  const root = document.documentElement

  previousScrollStyles = {
    overflow: root.style.overflow,
    paddingRight: root.style.paddingRight,
  }

  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
  const paddingRight = Number.parseFloat(getComputedStyle(root).paddingRight) || 0

  root.style.overflow = 'hidden'

  if (scrollbarWidth > 0) {
    root.style.paddingRight = `${paddingRight + scrollbarWidth}px`
  }
}

function unlockBackgroundScroll(): void {
  if (previousScrollStyles) {
    Object.assign(document.documentElement.style, previousScrollStyles)
    previousScrollStyles = null
  }
}

function cancelDeletion(): void {
  if (!isDeleting.value) {
    emit('cancel')
  }
}

async function confirmDeletion(): Promise<void> {
  if (isDeleting.value) {
    return
  }

  isDeleting.value = true
  errorMessage.value = ''

  try {
    await deleteRecipe(props.recipe.id)
    emit('deleted', props.recipe)
  } catch (error) {
    console.error('Rezept konnte nicht gelöscht werden:', error)
    errorMessage.value = 'Das Rezept konnte nicht gelöscht werden. Bitte versuche es erneut.'
  } finally {
    isDeleting.value = false

    if (errorMessage.value) {
      await nextTick()
      cancelButton.value?.focus({ preventScroll: true })
    }
  }
}

onMounted(() => {
  if (dialog.value) {
    lockBackgroundScroll()
    dialog.value.showModal()
    cancelButton.value?.focus({ preventScroll: true })
  }
})

onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
  }

  unlockBackgroundScroll()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="delete-confirmation"
    aria-labelledby="delete-confirmation-heading"
    aria-describedby="delete-confirmation-description delete-confirmation-hint"
    :aria-busy="isDeleting"
    @cancel.prevent="cancelDeletion"
  >
    <h2 id="delete-confirmation-heading">Rezept löschen</h2>

    <p id="delete-confirmation-description">
      Möchtest du das Rezept <strong>„{{ recipe.title }}“</strong> wirklich löschen?
    </p>

    <p id="delete-confirmation-hint" class="delete-hint">Das Rezept wird dauerhaft gelöscht.</p>

    <p v-if="errorMessage" class="delete-error" role="alert">
      {{ errorMessage }}
    </p>

    <fieldset class="delete-actions" :disabled="isDeleting" aria-label="Löschen bestätigen">
      <button
        ref="cancelButton"
        type="button"
        class="cancel-button"
        autofocus
        @click="cancelDeletion"
      >
        Abbrechen
      </button>

      <button type="button" class="confirm-delete-button" @click="confirmDeletion">
        {{ isDeleting ? 'Wird gelöscht …' : 'Endgültig löschen' }}
      </button>
    </fieldset>
  </dialog>
</template>

<style scoped>
.delete-confirmation {
  position: fixed;
  inset: 0;
  width: min(500px, calc(100vw - 32px));
  height: fit-content;
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 32px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  color: #263b32;
  background-color: #ffffff;
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
}

.delete-confirmation::backdrop {
  background-color: rgb(16 29 22 / 45%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.8rem;
}

p {
  margin: 16px 0;
  line-height: 1.6;
}

strong {
  overflow-wrap: anywhere;
}

.delete-hint {
  color: var(--color-muted);
}

.delete-error {
  color: #a52f2f;
}

.delete-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
  margin: 28px 0 0;
  padding: 0;
  border: 0;
}

button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.cancel-button {
  color: var(--color-primary);
  background-color: #ffffff;
}

.confirm-delete-button {
  border-color: #a52f2f;
  color: #ffffff;
  background-color: #a52f2f;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

@media (max-width: 520px) {
  .delete-confirmation {
    padding: 24px;
  }

  .delete-actions {
    flex-direction: column;
  }

  button {
    width: 100%;
  }
}
</style>
