import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('Tabs component', () => {
  afterEach(cleanup)

  it('renders tab list, active tab, and content correctly', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <Tabs defaultValue="tab1" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab One</TabsTrigger>
          <TabsTrigger value="tab2">Tab Two</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content for Tab One</TabsContent>
        <TabsContent value="tab2">Content for Tab Two</TabsContent>
      </Tabs>,
    )

    expect(screen.getByRole('tab', { name: 'Tab One' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Tab Two' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    expect(screen.getByText('Content for Tab One')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Tab Two' }))
    expect(onValueChange).toHaveBeenCalledWith('tab2')
    expect(screen.getByRole('tab', { name: 'Tab Two' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('Content for Tab Two')).toBeVisible()
  })

  it('supports keyboard navigation between tabs with Arrow keys', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="first">
        <TabsList>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="second">Second</TabsTrigger>
          <TabsTrigger value="third">Third</TabsTrigger>
        </TabsList>
      </Tabs>,
    )

    const firstTab = screen.getByRole('tab', { name: 'First' })
    firstTab.focus()
    expect(firstTab).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
