'use client';

import Script from 'next/script';

export default function ThirdPartyScripts() {
  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ4KRK7H5"
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-ZZQ4KRK7H5');
        `}
      </Script>

      {/* Google News Showcase */}
      <Script
        src="https://news.google.com/swg/js/v1/swg-basic.js"
        strategy="lazyOnload"
      />
      <Script id="google-news-showcase" strategy="lazyOnload">
        {`
          (self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
            basicSubscriptions.init({
              type: "NewsArticle",
              isPartOfType: ["Product"],
              isPartOfProductId: "CAownKXbCw:openaccess",
              clientOptions: { 
                theme: "light", 
                lang: "en",
                iframeAttributes: {
                  title: "Google News Showcase subscription service"
                }
              },
            });
          });
        `}
      </Script>
    </>
  );
} 