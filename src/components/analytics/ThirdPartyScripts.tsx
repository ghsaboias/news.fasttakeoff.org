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

      {/* Twitter Widgets - Optimized Loading */}
      <Script id="twitter-widgets" strategy="afterInteractive">
        {`
          window.twttr = (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0],
              t = window.twttr || {};
            if (d.getElementById(id)) return t;
            js = d.createElement(s);
            js.id = id;
            js.src = "https://platform.twitter.com/widgets.js";
            fjs.parentNode.insertBefore(js, fjs);

            t._e = [];
            t.ready = function(f) {
              t._e.push(f);
            };

            return t;
          }(document, "script", "twitter-wjs"));
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
                  title: "Google News Showcase background service - no content",
                  "aria-hidden": "true",
                  sandbox: "allow-scripts allow-same-origin",
                  referrerpolicy: "strict-origin-when-cross-origin"
                }
              },
            });
          });
        `}
      </Script>
    </>
  );
} 