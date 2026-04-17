import { useEffect } from 'react'

interface PageMetaOptions {
  title: string
  description: string
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  if (typeof document === 'undefined') return

  let element = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value)
  })
}

export function usePageMeta(options: PageMetaOptions) {
  useEffect(() => {
    document.title = options.title

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: options.description,
    })

    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: options.title,
    })

    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: options.description,
    })

    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    })

    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    })

    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: options.title,
    })

    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: options.description,
    })
  }, [options.description, options.title])
}
