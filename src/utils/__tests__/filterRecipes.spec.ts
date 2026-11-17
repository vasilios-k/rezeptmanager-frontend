import { describe, expect, it } from 'vitest'
import { exampleRecipes } from '@/data/exampleRecipes'
import { filterRecipes } from '@/utils/filterRecipes'

describe('filterRecipes', () => {
  it('zeigt bei einer leeren Suche alle Rezepte', () => {
    expect(filterRecipes(exampleRecipes, '')).toEqual(exampleRecipes)
    expect(filterRecipes(exampleRecipes, '   ')).toEqual(exampleRecipes)
  })

  it('findet Teile des Rezeptnamens unabhängig von der Schreibweise', () => {
    const result = filterRecipes(exampleRecipes, '  PFANN  ')

    expect(result.map((recipe) => recipe.id)).toEqual([1])
  })

  it('findet ganze Zutaten und Teile ihrer Namen', () => {
    const flourResults = filterRecipes(exampleRecipes, 'mEhL')
    const yeastResults = filterRecipes(exampleRecipes, 'HEFE')

    expect(flourResults.map((recipe) => recipe.id)).toEqual([1, 2])
    expect(yeastResults.map((recipe) => recipe.id)).toEqual([2])
  })

  it('ignoriert zusätzliche Leerzeichen innerhalb eines Namens', () => {
    const recipes = exampleRecipes.map((recipe) => ({
      ...recipe,
      title: recipe.id === 2 ? 'Schnelles   Brot' : recipe.title,
    }))

    const result = filterRecipes(recipes, ' SCHNELLES BROT ')

    expect(result.map((recipe) => recipe.id)).toEqual([2])
  })

  it('liefert keine Treffer für unbekannte Begriffe oder Anleitungstext', () => {
    expect(filterRecipes(exampleRecipes, 'Kokosnuss')).toEqual([])
    expect(filterRecipes(exampleRecipes, 'ausbacken')).toEqual([])
  })
})
