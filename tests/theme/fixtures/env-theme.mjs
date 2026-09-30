// Reports whether the environment leaked into the theme module's process.
export default { token: { colorPrimary: process.env.ANTD_A11Y_SENTINEL ? '#ff0000' : '#1677ff' } };
