import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';

// 使用 lazy() 进行按需加载
const WelcomeOverlay = lazy(() => import('./components/Welcome.tsx'))
const Home = lazy(() => import('./Home.tsx'));
const ArticleContent = lazy(() => import('./components/Article.tsx').then(m => ({ default: m.ArticleContent })));
const ArticleList = lazy(() => import('./components/Article.tsx').then(m => ({ default: m.ArticleList })));
const Imageshow = lazy(() => import('./components/Picture.tsx'));
const Test = lazy(() => import('./components/Test.tsx'));

const router = createHashRouter([
  {
    path: "/",
    element: <Suspense fallback={<div>Loading...</div>}><Home /></Suspense>,
    children: [
      {
        index: true,
        element: <Navigate to="/articleList" replace />,
      },
      {
        path: "articles/:title",
        element: <Suspense fallback={<div>Loading...</div>}><ArticleContent /></Suspense>,
      },
      {
        path: "articleList",
        element: <Suspense fallback={<div>Loading...</div>}><ArticleList /></Suspense>,
      },
      {
        path: "pictures",
        element: <Suspense fallback={<div>Loading...</div>}><Imageshow /></Suspense>,
      },
      {
        path: "test",
        element: <Suspense fallback={<div>Loading...</div>}><Test /></Suspense>,
      }
    ]
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WelcomeOverlay></WelcomeOverlay>
    <RouterProvider router={router} />
  </StrictMode>,
);

