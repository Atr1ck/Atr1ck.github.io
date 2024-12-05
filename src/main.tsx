import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './Home.tsx'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ArticleContent, ArticleList } from './components/Article.tsx'
import Imageshow from './components/Picture.tsx'

const router = createHashRouter([
  {
    path: "/",
    element: <Home />,
    children: [
      {
        index: true, // This matches the root of the parent route.
        element: <Navigate to="/articleList" replace />,
      },
      {
        path: "articles/:title",
        element: <ArticleContent />,
      },
      {
        path: "articleList",
        element: <ArticleList />,
      },
      {
        path: "pictures",
        element: <Imageshow />,
      }
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
