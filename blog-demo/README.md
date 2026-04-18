# blog-demo

name=v11-blog runtime=node-v25+ deps=0

## Routes

- / (app/page.fl)
- /about (app/about/page.fl)
- /blog (app/blog/page.fl)
- /blog/hello-v11 (app/blog/hello-v11/page.fl)
- /blog/build-static (app/blog/build-static/page.fl)
- /blog/auto-bind (app/blog/auto-bind/page.fl)

Each page.fl is self-contained: `(println full-html)`. No IMPORT, no shared
dependencies. This avoids current v11 serve import-resolve issues.

## Build

    node bootstrap.js build --static --app app --out dist --port 43088

Output is key=value on stdout:

    build.start app=app out=dist port=43088
    build.page route=/ ok=true file=dist/index.html bytes=3182
    build.page route=/about ok=true file=dist/about/index.html bytes=2268
    ...
    build.done ok=6 fail=0 out=dist

## Deploy

Upload `dist/` to any static host (Netlify/Vercel/Cloudflare Pages/S3/GitHub Pages).

## Interactive demo

/blog/auto-bind contains a working counter (data-fl-bind + data-fl-click +
data-fl-model) implemented with inline JS. Open in a browser to test.

## Notes

- v11 serve app-router currently fails to resolve some IMPORT paths and
  returns "Internal Server Error" text with HTTP 200. build --static
  detects this via isUseful() and falls back to run mode.
- Dynamic routes ([slug]) are skipped. generateStaticParams-style API
  is a future addition.
