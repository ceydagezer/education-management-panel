import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Daha önce alınmış veri kısa süre boyunca ekranda kalır.
      // Sayfalar arasında gidip gelirken gereksiz loading sıçramalarını azaltır.
      staleTime: 30_000,

      // Kullanıcı tarayıcı sekmesine geri döndüğünde her sorguyu otomatik
      // tekrar çalıştırma. Gerekli ekranlarda kontrollü invalidation/refetch yapacağız.
      refetchOnWindowFocus: false,

      // Geçici ağ hatasında kullanıcıyı uzun süre bekletmemek için tek tekrar.
      retry: 1,
    },
  },
})
