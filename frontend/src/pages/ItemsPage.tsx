import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createItem, fetchItems } from '../api/items'

export function ItemsPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()
  const items = useQuery({ queryKey: ['items'], queryFn: fetchItems })
  const create = useMutation({
    mutationFn: createItem,
    onSuccess: async () => {
      setName('')
      setDescription('')
      await queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({ name, description: description || undefined })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Items</h1>
        <p className="mt-2 text-slate-600">
          Create a record and persist it in PostgreSQL.
        </p>
        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <label className="block text-sm font-semibold" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <label className="block text-sm font-semibold" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {create.error && (
            <p role="alert" className="text-sm text-brand">
              {create.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={create.isPending || !name.trim()}
            className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create item'}
          </button>
        </form>
      </section>

      <section aria-live="polite" className="lg:pt-16">
        {items.isPending && (
          <p className="rounded-xl bg-white p-6 text-slate-600">
            Loading items…
          </p>
        )}
        {items.isError && (
          <div
            role="alert"
            className="rounded-xl border border-brand/30 bg-brand/5 p-6 text-brand"
          >
            Could not load items: {items.error.message}
          </div>
        )}
        {items.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold">No items yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use the form to create the first item.
            </p>
          </div>
        )}
        {items.data && items.data.length > 0 && (
          <ul className="space-y-3" aria-label="Items list">
            {items.data.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <h2 className="font-semibold text-ink">{item.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {item.description || 'No description'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
