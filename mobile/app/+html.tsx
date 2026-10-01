import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { APP_BRAND } from '../config/appBrand';
import { THEME } from '../config/appConfig';
import { getWebBasePath, webAssetPath } from '../lib/webBasePath';

export default function Root({ children }: { children: React.ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  const manifestHref = webAssetPath('/manifest.webmanifest');
  const appleIconHref = webAssetPath('/icons/apple-touch-icon.png');

  return (
    <html lang="en" suppressHydrationWarning {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={THEME.primaryDark} />
        <meta name="application-name" content={APP_BRAND.shortName} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_BRAND.shortName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="meal-prep-base" content={getWebBasePath() || '/'} />
        <link rel="manifest" href={manifestHref} />
        <link rel="apple-touch-icon" href={appleIconHref} />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body suppressHydrationWarning {...bodyAttributes}>
        {children}
        {bodyNodes}
        <script src={webAssetPath('/pwa-register.js')} defer />
      </body>
    </html>
  );
}
