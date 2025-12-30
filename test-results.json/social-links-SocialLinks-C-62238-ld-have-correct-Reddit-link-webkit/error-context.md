# Page snapshot

```yaml
- generic [active]:
  - alert [ref=e1]
  - dialog "Server Error" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - navigation [ref=e8]:
          - button "previous" [disabled] [ref=e9]:
            - img "previous" [ref=e10]
          - button "next" [disabled] [ref=e12]:
            - img "next" [ref=e13]
          - generic [ref=e15]: 1 of 1 error
          - generic [ref=e16]:
            - text: Next.js (14.2.33) is outdated
            - link "(learn more)" [ref=e18]:
              - /url: https://nextjs.org/docs/messages/version-staleness
        - heading "Server Error" [level=1] [ref=e19]
        - paragraph [ref=e20]: "TypeError: Cannot read properties of null (reading 'useContext')"
        - generic [ref=e21]: This error happened while generating the page. Any console logs will be displayed in the terminal window.
      - generic [ref=e22]:
        - heading "Call Stack" [level=2] [ref=e23]
        - group [ref=e24]:
          - generic "Next.js" [ref=e25] [cursor=pointer]:
            - img [ref=e26]
            - img [ref=e28]
            - text: Next.js
        - generic [ref=e34]:
          - heading "PathnameContext" [level=3] [ref=e35]
          - generic [ref=e37]: webpack:/src/client/components/navigation.ts
        - generic [ref=e38]:
          - heading "ErrorBoundary" [level=3] [ref=e39]
          - generic [ref=e41]: webpack:/src/client/components/error-boundary.tsx
        - group [ref=e42]:
          - generic "Next.js" [ref=e43] [cursor=pointer]:
            - img [ref=e44]
            - img [ref=e46]
            - text: Next.js
```