import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 使用 lazy() 进行按需加载
const WelcomeOverlay = lazy(() => import('./components/Welcome/Welcome.tsx'))
const Home = lazy(() => import('./Home.tsx'));
const ArticleContent = lazy(() => import('./components/Articles/ArticleContent.tsx'));
const ArticleList = lazy(() => import('./components/Articles/ArticleList.tsx'));
const Imageshow = lazy(() => import('./components/Picture/Picture.tsx'));
const Test = lazy(() => import('./components/Test/Test.tsx'));
const Loading = lazy(() => import('./components/Load/Load.tsx'))
const AdminLayout = lazy(() => import('./admin/AdminLayout.tsx'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard.tsx'));
const ArticleEditor = lazy(() => import('./admin/ArticleEditor.tsx'));

if (["/", "/index.html"].includes(window.location.pathname) && window.location.hash.startsWith("#/")) {
  window.history.replaceState(null, "", window.location.hash.slice(1));
}

const publicShell = (
  <Suspense fallback={<Loading />}>
    <WelcomeOverlay />
    <Home />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: publicShell,
    children: [
      {
        index: true,
        element: <Navigate to="/articleList" replace />,
      },
      {
        path: "articles/:slug",
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
  },
  {
    path: "/admin",
    element: <Suspense fallback={<Loading />}><AdminLayout /></Suspense>,
    children: [
      { index: true, element: <Suspense fallback={<Loading />}><AdminDashboard /></Suspense> },
      { path: "articles/new", element: <Suspense fallback={<Loading />}><ArticleEditor /></Suspense> },
      { path: "articles/:slug", element: <Suspense fallback={<Loading />}><ArticleEditor /></Suspense> },
    ],
  },
  { path: "*", element: <Navigate to="/articleList" replace /> },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
