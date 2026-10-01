import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { APP_NAME, APP_SHORT_NAME, THEME } from '../config/appConfig';
import { getWebBasePath, webAssetPath } from '../lib/webBasePath';

export default function Root({ children }: { children: React.ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  const manifestHref = webAssetPath('/manifest.webmanifest');
  const appleIconHref = webAssetPath('/icons/apple-touch-icon.png');

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <title>{APP_NAME}</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={THEME.emerald} />
        <meta name="application-name" content={APP_SHORT_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_SHORT_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="meal-prep-base" content={getWebBasePath() || '/'} />
        <link rel="manifest" href={manifestHref} />
        <link rel="apple-touch-icon" href={appleIconHref} />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
        <script src={webAssetPath('/pwa-register.js')} defer />
      </body>
    </html>
  );
}
