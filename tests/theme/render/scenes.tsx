// Components in the states the pair map names, for the render check (and for finding which token an
// element's colour comes from). Popups use antd's inline "pure panel" so they render in place.
import type { ComponentType, ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Calendar,
  Card,
  Cascader,
  Checkbox,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  List,
  Mentions,
  Menu,
  Modal,
  Pagination,
  Popconfirm,
  Popover,
  Progress,
  Radio,
  Rate,
  Result,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Tour,
  Tree,
  TreeSelect,
  Typography,
  Upload,
  message,
  notification,
} from 'antd';

type Panel = ComponentType<Record<string, unknown>>;
const pure = (component: unknown): Panel =>
  (component as { _InternalPanelDoNotUseOrYouWillBeFired: Panel })._InternalPanelDoNotUseOrYouWillBeFired;

const options = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry', disabled: true },
];
const menuItems = [
  { key: 'a', label: 'Apple' },
  { key: 'b', label: 'Banana' },
  { key: 'd', label: 'Delete', danger: true },
  { key: 'c', label: 'Cherry', disabled: true },
  { type: 'group' as const, key: 'g', label: 'Group', children: [{ key: 'e', label: 'Elder' }] },
];
const treeData = [
  { key: 'a', title: 'Apple', children: [{ key: 'a1', title: 'Apple one' }, { key: 'a2', title: 'Apple two', disabled: true }] },
  { key: 'b', title: 'Banana' },
];
const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name), filters: [{ text: 'A', value: 'A' }] },
  { title: 'Age', dataIndex: 'age', key: 'age' },
];
const rows = [
  { key: '1', name: 'Ann', age: 30 },
  { key: '2', name: 'Bob', age: 40 },
];

export const scenes: Record<string, () => ReactNode> = {
  typography: () => (
    <Typography>
      <Typography.Title level={1}>Heading one</Typography.Title>
      <Typography.Title level={5}>Heading five</Typography.Title>
      <Typography.Paragraph className="t-body">Body text</Typography.Paragraph>
      <Typography.Text type="secondary">Secondary</Typography.Text>{' '}
      <Typography.Text type="success">Success</Typography.Text>{' '}
      <Typography.Text type="warning">Warning</Typography.Text>{' '}
      <Typography.Text type="danger">Danger</Typography.Text>{' '}
      <Typography.Text disabled>Disabled</Typography.Text>{' '}
      <Typography.Link href="#x">Link</Typography.Link>{' '}
      <Typography.Text mark>Marked</Typography.Text> <Typography.Text code>code</Typography.Text>
    </Typography>
  ),
  button: () => (
    <div>
      <Button className="t-default">Default</Button>
      <Button className="t-primary" type="primary">Primary</Button>
      <Button className="t-dashed" type="dashed">Dashed</Button>
      <Button className="t-text" type="text">Text</Button>
      <Button className="t-link" type="link">Link</Button>
      <Button className="t-danger" danger>Danger</Button>
      <Button className="t-danger-primary" type="primary" danger>Danger primary</Button>
      <Button className="t-danger-text" type="text" danger>Danger text</Button>
      <Button className="t-danger-link" type="link" danger>Danger link</Button>
      <Button className="t-disabled" disabled>Disabled</Button>
      <Button className="t-primary-disabled" type="primary" disabled>Disabled primary</Button>
      <Button className="t-dashed-disabled" type="dashed" disabled>Disabled dashed</Button>
      <div style={{ background: '#333', padding: 8 }}>
        <Button className="t-ghost" ghost>Ghost</Button>
        <Button className="t-ghost-primary" type="primary" ghost>Ghost primary</Button>
      </div>
      <Button className="t-solid" color="default" variant="solid">Solid</Button>
      <Button className="t-filled" color="primary" variant="filled">Filled</Button>
    </div>
  ),
  input: () => (
    <div>
      <Input className="t-outlined" placeholder="Placeholder" />
      <Input className="t-value" defaultValue="Value" />
      <Input className="t-filled" variant="filled" defaultValue="Filled" />
      <Input className="t-error" status="error" defaultValue="Error" />
      <Input className="t-warning" status="warning" defaultValue="Warning" />
      <Input className="t-disabled" disabled defaultValue="Disabled" />
      <Input className="t-addon" addonBefore="https://" defaultValue="site" />
      <Input.TextArea className="t-textarea" placeholder="Area" />
      <InputNumber className="t-number" defaultValue={3} />
      <Mentions className="t-mentions" placeholder="Mention" />
    </div>
  ),
  form: () => (
    <Form layout="vertical">
      <Form.Item label="Name" required validateStatus="error" help="Name is required">
        <Input />
      </Form.Item>
      <Form.Item label="Plain" extra="Extra help text">
        <Input />
      </Form.Item>
    </Form>
  ),
  select: () => {
    const SelectPanel = pure(Select);
    return (
      <div>
        <Select className="t-select" defaultValue="a" options={options} style={{ width: 160 }} />
        <Select className="t-placeholder" placeholder="Pick one" options={options} style={{ width: 160 }} />
        <Select className="t-multiple" mode="multiple" defaultValue={['a', 'b']} options={options} style={{ width: 240 }} />
        <SelectPanel defaultValue="a" options={options} open />
      </div>
    );
  },
  cascader: () => {
    const Panel = pure(Cascader);
    return <Panel open defaultValue={['a']} options={[{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }]} />;
  },
  treeSelect: () => {
    const Panel = pure(TreeSelect);
    return <Panel open defaultValue="a" treeData={treeData.map((n) => ({ ...n, value: n.key }))} treeDefaultExpandAll />;
  },
  datePicker: () => {
    const Panel = pure(DatePicker);
    return <Panel open />;
  },
  calendar: () => <Calendar fullscreen={false} />,
  checkboxRadio: () => (
    <div>
      <Checkbox className="t-checkbox" defaultChecked>Checked</Checkbox>
      <Checkbox className="t-checkbox-off">Unchecked</Checkbox>
      <Checkbox disabled>Disabled</Checkbox>
      <Radio className="t-radio" defaultChecked>Radio</Radio>
      <Radio.Group className="t-radio-buttons" defaultValue="a" options={options} optionType="button" />
      <Radio.Group className="t-radio-solid" defaultValue="a" options={options} optionType="button" buttonStyle="solid" />
      <Switch className="t-switch-on" defaultChecked />
      <Switch className="t-switch-off" />
    </div>
  ),
  menu: () => (
    <div>
      <Menu className="t-light" mode="inline" defaultSelectedKeys={['a']} items={menuItems} style={{ width: 200 }} />
      <Menu className="t-dark" theme="dark" mode="inline" defaultSelectedKeys={['a']} items={menuItems} style={{ width: 200 }} />
      <Menu className="t-horizontal" mode="horizontal" defaultSelectedKeys={['a']} items={menuItems.slice(0, 3)} />
    </div>
  ),
  dropdown: () => {
    const Panel = pure(Dropdown);
    return <Panel open menu={{ items: menuItems }}><Button>Open</Button></Panel>;
  },
  tabs: () => (
    <div>
      <Tabs className="t-line" items={[{ key: 'a', label: 'Apple' }, { key: 'b', label: 'Banana' }, { key: 'c', label: 'Cherry', disabled: true }]} />
      <Tabs className="t-card" type="card" items={[{ key: 'a', label: 'Apple' }, { key: 'b', label: 'Banana' }]} />
    </div>
  ),
  table: () => <Table columns={columns} dataSource={rows} rowSelection={{ defaultSelectedRowKeys: ['1'] }} pagination={false} footer={() => 'Footer'} />,
  pagination: () => (
    <div>
      <Pagination className="t-pagination" defaultCurrent={2} total={50} />
      <Pagination className="t-disabled" disabled defaultCurrent={2} total={50} />
    </div>
  ),
  tag: () => (
    <div>
      <Tag className="t-default">Default</Tag>
      <Tag className="t-blue" color="blue">Blue</Tag>
      <Tag className="t-success" color="success">Success</Tag>
      <Tag className="t-error" color="error">Error</Tag>
      <Tag className="t-warning" color="warning">Warning</Tag>
      <Tag className="t-processing" color="processing">Processing</Tag>
      <Tag.CheckableTag className="t-checkable" checked>Checked</Tag.CheckableTag>
    </div>
  ),
  alert: () => (
    <div>
      <Alert className="t-success" type="success" message="Success" description="Details" showIcon />
      <Alert className="t-info" type="info" message="Info" showIcon />
      <Alert className="t-warning" type="warning" message="Warning" showIcon />
      <Alert className="t-error" type="error" message="Error" showIcon />
    </div>
  ),
  badge: () => (
    <div>
      <Badge count={5}><Avatar shape="square">A</Avatar></Badge>
      <Badge status="success" text="Success" />
      <Avatar.Group><Avatar>A</Avatar><Avatar>B</Avatar></Avatar.Group>
    </div>
  ),
  breadcrumb: () => <Breadcrumb items={[{ title: <a href="#h">Home</a> }, { title: 'Page' }]} />,
  card: () => (
    <Card title="Title" extra={<a href="#m">More</a>} actions={[<span key="a">Action</span>]}>
      Card content
    </Card>
  ),
  collapse: () => (
    <div>
      <Collapse defaultActiveKey={['a']} items={[{ key: 'a', label: 'Header', children: 'Content' }]} />
      <Collapse className="t-borderless" bordered={false} defaultActiveKey={['a']} items={[{ key: 'a', label: 'Header', children: 'Content' }]} />
    </div>
  ),
  descriptions: () => <Descriptions title="Title" bordered extra={<span>Extra</span>} items={[{ key: 'a', label: 'Label', children: 'Content' }]} />,
  layout: () => (
    <Layout>
      <Layout.Header>Header</Layout.Header>
      <Layout>
        <Layout.Sider collapsible>Sider</Layout.Sider>
        <Layout.Content>Content</Layout.Content>
      </Layout>
      <Layout.Sider className="t-light-sider" theme="light" collapsible>Light</Layout.Sider>
      <Layout.Footer>Footer</Layout.Footer>
    </Layout>
  ),
  list: () => <List header="Header" footer="Footer" dataSource={['One']} renderItem={(item) => <List.Item>{item}</List.Item>} />,
  modal: () => {
    const Panel = pure(Modal);
    return <Panel title="Title" footer={<Button>OK</Button>}>Modal body</Panel>;
  },
  messageNotification: () => {
    const MessagePanel = pure(message);
    const NotificationPanel = pure(notification);
    return (
      <div>
        <MessagePanel type="success" content="Saved" />
        <NotificationPanel message="Title" description="Description" />
      </div>
    );
  },
  popups: () => {
    const TooltipPanel = pure(Tooltip);
    const PopoverPanel = pure(Popover);
    const PopconfirmPanel = pure(Popconfirm);
    return (
      <div>
        <TooltipPanel title="Tooltip text" />
        <PopoverPanel title="Popover title" content="Popover content" />
        <PopconfirmPanel title="Sure?" description="Really" />
      </div>
    );
  },
  tour: () => {
    const Panel = pure(Tour);
    return <Panel type="primary" title="Step" description="Details" current={1} total={3} />;
  },
  progressSteps: () => (
    <div>
      <Progress className="t-line" percent={40} />
      <Progress className="t-circle" type="circle" percent={40} />
      <Steps current={1} items={[{ title: 'Done' }, { title: 'Current' }, { title: 'Waiting' }]} />
      <Steps className="t-nav" type="navigation" current={1} items={[{ title: 'Done' }, { title: 'Current' }, { title: 'Waiting' }]} />
    </div>
  ),
  rateSliderSegmented: () => (
    <div>
      <Rate defaultValue={3} />
      <Slider defaultValue={30} />
      <Slider className="t-disabled" disabled defaultValue={30} />
      <Segmented options={['Apple', 'Banana', { label: 'Cherry', value: 'Cherry', disabled: true }]} />
    </div>
  ),
  tree: () => (
    <div>
      <Tree defaultExpandAll defaultSelectedKeys={['a1']} treeData={treeData} />
      <Tree.DirectoryTree className="t-directory" defaultExpandAll defaultSelectedKeys={['a1']} treeData={treeData} />
    </div>
  ),
  timeline: () => <Timeline items={[{ children: 'First' }, { children: 'Second' }]} />,
  upload: () => (
    <Upload defaultFileList={[{ uid: '1', name: 'file.png', status: 'done' }, { uid: '2', name: 'bad.png', status: 'error' }]}>
      <Button>Upload</Button>
    </Upload>
  ),
  misc: () => (
    <div>
      <Divider>Divider</Divider>
      <Empty />
      <Result status="success" title="Result title" subTitle="Sub title" />
      <Statistic title="Statistic" value={42} />
      <Skeleton active />
    </div>
  ),
};
