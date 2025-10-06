import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)
// 禁用 Git 信息读取，避免在无 .git 环境下的构建警告
if (!process.env.DOCUSAURUS_DISABLE_GIT_INFO) process.env.DOCUSAURUS_DISABLE_GIT_INFO = 'true';
if (!process.env.DISABLE_GIT_INFO) process.env.DISABLE_GIT_INFO = 'true';

const config: Config = {
  title: 'Happy-TTS API 文档',
  tagline: 'Happy-TTS 文本转语音服务 API 文档',
  favicon: 'img/favicon.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://tts-api-docs.hapxs.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'happy-tts', // Usually your GitHub org/user name.
  projectName: 'happy-tts', // Usually your repo name.

  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'ignore',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // 禁用Git历史信息获取，避免在Docker环境中出现Git相关警告
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        blog: {
          showReadingTime: true,
          blogSidebarTitle: '所有博客',
          blogSidebarCount: 'ALL',
          postsPerPage: 100,
          path: './blog',
          routeBasePath: 'blog',
          blogTitle: '项目博客',
          blogDescription: '项目开发与实现相关博客',
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
          feedOptions: {
            type: 'all',
            copyright: `Copyright © ${new Date().getFullYear()} Happy-TTS`,
          },
          // 忽略未在 authors.yml 定义的内联作者和未添加截断标记的博文警告
          onInlineAuthors: 'ignore',
          onUntruncatedBlogPosts: 'ignore',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/social-card.svg',
    navbar: {
      title: 'Happy-TTS API',
      logo: {
        alt: 'Happy-TTS Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API 文档',
        },
        {
          to: '/blog',
          label: '博客',
          position: 'left'
        },
        {
          href: 'https://github.com/hapxscom/happy-tts',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: 'API 文档',
              to: '/docs/intro',
            },
            {
              label: '快速开始',
              to: '/docs/getting-started',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/hapxscom/happy-tts/issues',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/hapxscom/happy-tts',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Happy-TTS.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    metadata: [
      {name: 'keywords', content: 'TTS, 文本转语音, API, 文档'},
      {name: 'description', content: 'Happy-TTS 文本转语音服务 API 文档'},
    ],
  } satisfies Preset.ThemeConfig,

  // 添加自定义配置
  customFields: {
    // 自定义字段
  },

  // 添加端口配置
  scripts: [
    // 可以添加自定义脚本
  ],

  // 添加样式配置
  stylesheets: [
    // 可以添加自定义样式表
  ],

  // 添加插件配置
  plugins: [
    require.resolve('./plugins/email-protection'),
  ],

  // 添加主题配置
  themes: [
    // 可以添加自定义主题
  ],

  clientModules: [
    require.resolve('./src/clientModules/fixNavbar.js'),
    require.resolve('./src/clientModules/scrollNavbar.js'),
    require.resolve('./src/clientModules/routeModules.js'),
    require.resolve('./src/clientModules/emailProtection.js'),
    require.resolve('./src/clientModules/policyEnforcement.js'),
  ],
};

export default config;