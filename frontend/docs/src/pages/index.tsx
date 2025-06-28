import React, { useState } from 'react';
import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            开始使用 - 5min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} style={{marginLeft: 8, background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 20, verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center'}} title={copied ? '已复制' : '复制到剪贴板'}>
      {copied ? (
        <span style={{fontSize: 22, color: '#22c55e', transition: 'color 0.2s'}}>✓</span>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      )}
    </button>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Happy-TTS 文本转语音服务 API 文档 - 快速集成、高质量语音合成、多语言支持">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        
        {/* 新增：特色功能展示 */}
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <div className="col col--4">
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>🚀</div>
                  <h3>快速集成</h3>
                  <p>简单易用的 RESTful API，支持多种编程语言，快速集成到您的应用中。</p>
                </div>
              </div>
              <div className="col col--4">
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>🎯</div>
                  <h3>高质量语音</h3>
                  <p>基于先进的深度学习技术，提供自然流畅、情感丰富的语音合成效果。</p>
                </div>
              </div>
              <div className="col col--4">
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>🌍</div>
                  <h3>多语言支持</h3>
                  <p>支持中文、英文等多种语言，满足全球用户的多语言需求。</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 新增：快速开始指南 */}
        <section className={styles.quickStart}>
          <div className="container">
            <div className="text--center margin-bottom--xl">
              <Heading as="h2">快速开始</Heading>
              <p>在几分钟内开始使用 Happy-TTS API</p>
            </div>
            <div className="row">
              <div className="col col--6">
                <div className={styles.codeBlock} style={{position: 'relative'}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                    <h4 style={{margin: 0}}>1. 获取 API Key</h4>
                    <CopyButton text={`curl -X POST https://tts-api.hapxs.com/api/auth/register \
  -H \"Content-Type: application/json\" \
  -d '{"username": "your_username", "password": "your_password"}'`} />
                  </div>
                  <pre><code>{`curl -X POST https://tts-api.hapxs.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'`}</code></pre>
                </div>
              </div>
              <div className="col col--6">
                <div className={styles.codeBlock} style={{position: 'relative'}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                    <h4 style={{margin: 0}}>2. 调用 TTS 接口</h4>
                    <CopyButton text={`curl -X POST https://tts-api.hapxs.com/api/tts/generate \
  -H \"Authorization: Bearer YOUR_TOKEN\" \
  -H \"Content-Type: application/json\" \
  -d '{"text": "Hello, World!", "model": "tts-1", "voice": "alloy"}'`} />
                  </div>
                  <pre><code>{`curl -X POST https://tts-api.hapxs.com/api/tts/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, World!", "model": "tts-1", "voice": "alloy"}'`}</code></pre>
                </div>
              </div>
            </div>
            <div className="text--center margin-top--xl">
              <Link className="button button--primary button--lg" to="/docs/getting-started">
                查看完整文档 →
              </Link>
            </div>
          </div>
        </section>

        {/* 新增：技术栈展示 */}
        <section className={styles.techStack}>
          <div className="container">
            <div className="text--center margin-bottom--xl">
              <Heading as="h2">支持的技术栈</Heading>
              <p>我们提供多种编程语言的 SDK 和示例代码</p>
            </div>
            <div className="row">
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>⚡</div>
                  <span>JavaScript</span>
                </div>
              </div>
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>🐍</div>
                  <span>Python</span>
                </div>
              </div>
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>☕</div>
                  <span>Java</span>
                </div>
              </div>
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>🦀</div>
                  <span>Rust</span>
                </div>
              </div>
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>🐹</div>
                  <span>Go</span>
                </div>
              </div>
              <div className="col col--2">
                <div className={styles.techItem}>
                  <div className={styles.techIcon}>🔧</div>
                  <span>REST API</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
