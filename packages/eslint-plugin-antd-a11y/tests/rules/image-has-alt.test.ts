import rule from '../../src/rules/image-has-alt.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };

run('image-has-alt', rule, {
  valid: [
    w(`<Image src="a.png" alt="Product photo" />`),
    w(`<Image src="a.png" alt="" />`),
    w(`<Image src="a.png" alt={name} />`),
    w(`<Image {...img} />`),
    `import Image from 'next/image'; <Image src="a.png" />`,
  ],
  invalid: [
    { code: w(`<Image src="a.png" />`), errors: [error] },
    { code: w(`<Image width={200} src={url} preview={false} />`), errors: [error] },
  ],
});
