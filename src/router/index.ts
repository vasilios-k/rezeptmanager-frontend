import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'recipes',
      component: HomeView,
    },
    {
      path: '/recipes/:id',
      name: 'recipe-detail',
      component: () => import('@/views/RecipeDetailView.vue'),
      props: true,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false

    return { top: 0 }
  },
})

router.afterEach((to, from) => {
  if (to.path === from.path && from.matched.length > 0) return

  document.title =
    to.name === 'recipe-detail' ? 'Rezept | Rezeptmanager' : 'Meine Rezepte | Rezeptmanager'
})

export default router
