import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './Home.tsx'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ArticleContent, ArticleList } from './Article.tsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    children: [
      {
        index: true, // This matches the root of the parent route.
        element: <Navigate to="/articleList" replace />,
      },
      {
        path: "articles/:name",
        element: <ArticleContent />,
      },
      {
        path: "articleList",
        element: <ArticleList />,
      }
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
