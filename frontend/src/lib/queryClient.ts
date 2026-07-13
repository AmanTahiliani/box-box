import { QueryClient } from '@tanstack/react-query'
import { availabilityAwareStructuralSharing } from './fetch'

/** Shared QueryClient defaults — availability-aware structural sharing for header metadata. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Explicit Retry on RouteState — avoid automatic retry storms.
        retry: false,
        structuralSharing: availabilityAwareStructuralSharing,
      },
    },
  })
}
