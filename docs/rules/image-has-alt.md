# antd-a11y/image-has-alt

antd `Image` needs an `alt`, or `alt=""` when the image is decorative.

**Impact:** serious
**WCAG:** 1.1.1 Non-text Content

`jsx-a11y/alt-text` only checks native `<img>`. antd's `Image` passes `alt` through to the `<img>`, so leaving it out gives an image with no text alternative, and screen readers may read out the file name.

## Fails

```jsx
<Image src={product.photo} width={200} />
```

## Passes

```jsx
<Image src={product.photo} alt={product.name} />
<Image src="/divider.png" alt="" />
```
