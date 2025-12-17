import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';

// 使用 lazy() 进行按需加载
const WelcomeOverlay = lazy(() => import('./components/Welcome/Welcome.tsx'))
const Home = lazy(() => import('./Home.tsx'));
const ArticleContent = lazy(() => import('./components/Articles/ArticleContent.tsx'));
const ArticleList = lazy(() => import('./components/Articles/ArticleList.tsx'));
const Imageshow = lazy(() => import('./components/Picture/Picture.tsx'));
const Test = lazy(() => import('./components/Test/Test.tsx'));
const Loading = lazy(() => import('./components/Load/Load.tsx'))

const router = createHashRouter([
  {
    path: "/",
    element: <Suspense fallback={<Loading />}><Home /></Suspense>,
    children: [
      {
        index: true,
        element: <Navigate to="/articleList" replace />,
      },
      {
        path: "articles/:title",
        element: <Suspense fallback={<Loading />}><ArticleContent /></Suspense>,
      },
      {
        path: "articleList",
        element: <Suspense fallback={<Loading />}><ArticleList /></Suspense>,
      },
      {
        path: "pictures",
        element: <Suspense fallback={<Loading />}><Imageshow /></Suspense>,
      },
      {
        path: "test",
        element: <Suspense fallback={<Loading />}><Test /></Suspense>,
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

