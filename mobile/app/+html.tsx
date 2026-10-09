import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { APP_BRAND } from '../config/appBrand';
import { THEME } from '../config/appConfig';
import { getWebBasePath, webAssetPath } from '../lib/webBasePath';

/**
 * Figtree (approved design D-2), served from our own site so no outside font service is called.
 * App text has no font of its own, so it takes Figtree; icons set their own icon font and are
 * left alone (the :not() below), as is anything else that names a font.
 */
function fontCss(): string {
  const src = webAssetPath('/fonts/Figtree-Variable.woff2');
  const stack = "Figtree, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  return [
    `@font-face{font-family:Figtree;src:url(${src}) format('woff2');font-weight:300 900;font-style:normal;font-display:swap}`,
    `html,body{font-family:${stack}}`,
    `[dir]:not([class*="r-fontFamily-"]):not([style*="font-family"]),input,textarea,button{font-family:${stack}}`,
  ].join('');
}

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
        <link rel="preload" href={webAssetPath('/fonts/Figtree-Variable.woff2')} as="font" type="font/woff2" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: fontCss() }} />
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
