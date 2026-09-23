import rule from '../../src/rules/icon-button-has-name.js';
import { run, withImports as w } from '../rule-tester.js';

const error = { messageId: 'missing' };
const weak = { messageId: 'iconLabelOnly' };

run('icon-button-has-name', rule, {
  valid: [
    w(`<Button>Save</Button>`),
    w(`<Button icon={<DeleteOutlined />}>Delete</Button>`),
    w(`<Button icon={<DeleteOutlined />} aria-label="Delete" />`),
    w(`<Button icon={<DeleteOutlined />} title="Delete" />`),
    w(`<Button icon={<DeleteOutlined />} aria-labelledby="del-label" />`),
    w(`<Button icon={<DeleteOutlined />}>{t('delete')}</Button>`),
    w(`<Button icon={<DeleteOutlined />} {...props} />`),
    w(`<Button><img src="x.png" alt="Delete" /></Button>`),
    w(`<Button icon={<DeleteOutlined aria-label="Delete row" />} />`),
    // Custom or dynamic icons: can't see what they render
    w(`<Button icon={<TrashIcon />} />`),
    w(`<Button icon={icon} />`),
    w(`<Button><TrashIcon /></Button>`),
    // Not antd
    `import { Button } from './my-button'; <Button icon={<X />} />`,
    `const Button = (p) => null; <Button icon={<X />} />`,
    // Shadowed antd import
    `import { Button } from 'antd'; function F({ Button }) { return <Button icon={<X />} />; }`,
  ],
  invalid: [
    { code: w(`<Button icon={<DeleteOutlined />} />`), errors: [{ ...weak, data: { icon: 'delete' } }] },
    { code: w(`<Button type="text" shape="circle" icon={<DeleteOutlined />}></Button>`), errors: [weak] },
    { code: w(`<Button><DeleteOutlined /></Button>`), errors: [weak] },
    { code: w(`<Button icon={<DeleteOutlined />} aria-label="" />`), errors: [weak] },
    { code: w(`<Tooltip title="Delete"><Button icon={<DeleteOutlined />} /></Tooltip>`), errors: [weak] },
    { code: w(`<Button icon={<svg viewBox="0 0 1 1" />} />`), errors: [error] },
    { code: w(`<Button><img src="trash.png" /></Button>`), errors: [error] },
    { code: w(`<Button><i className="fa fa-trash" /></Button>`), errors: [error] },
    // Aliased and namespace imports
    { code: `import { Button as AntButton } from 'antd'; <AntButton icon={<svg />} />`, errors: [error] },
    { code: `import * as antd from 'antd'; <antd.Button icon={<svg />} />`, errors: [error] },
    { code: `import Button from 'antd/es/button'; <Button icon={<svg />} />`, errors: [error] },
    { code: `import { Button } from 'antd'; import { MoreOutlined } from '@ant-design/icons'; <Button icon={<MoreOutlined />} />`, errors: [{ ...weak, data: { icon: 'more' } }] },
  ],
});
