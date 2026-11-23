<script setup lang="ts">
defineProps<{
  loading: boolean
  busy: boolean
  errorMessage: string
}>()

defineEmits<{
  login: []
  signup: []
}>()
</script>

<template>
  <section class="auth-welcome" aria-labelledby="auth-heading">
    <p class="eyebrow">Deine Rezeptsammlung</p>
    <h1 id="auth-heading">Deine Rezepte an einem Ort.</h1>
    <p class="auth-description">
      Speichere deine Lieblingsrezepte, passe Portionen an und plane deinen Einkauf. Melde dich an,
      um deine Sammlung zu öffnen.
    </p>

    <p v-if="loading" class="auth-loading" role="status">Deine Anmeldung wird geprüft …</p>

    <template v-else>
      <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

      <div class="auth-actions">
        <button type="button" class="auth-button" :disabled="busy" @click="$emit('login')">
          {{ busy ? 'Bitte warten …' : 'Anmelden' }}
        </button>
        <button
          type="button"
          class="auth-button secondary"
          :disabled="busy"
          @click="$emit('signup')"
        >
          Konto erstellen
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.auth-welcome {
  max-width: 760px;
  margin: 24px auto;
  padding: clamp(24px, 5vw, 56px);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 6px 24px rgb(38 59 50 / 4%);
}

.auth-description,
.auth-loading {
  margin-top: 24px;
  color: var(--color-muted);
  line-height: 1.7;
}

.auth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.auth-button {
  min-height: 44px;
  padding: 12px 20px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.auth-button.secondary {
  background: #f4f7f1;
  color: var(--color-primary);
}

.auth-button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.auth-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.auth-error {
  margin-top: 24px;
  color: #a52f2f;
  line-height: 1.6;
}
</style>
