const CACHE_VERSION = '1.1.0';
const CACHE_NAME = 'co2-monitor-v' + CACHE_VERSION;

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// 安装 Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker 安装中，版本:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('缓存资源中...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // 立即激活新版本
    );
});

// 激活 Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker 激活，版本:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('co2-monitor-') && name !== CACHE_NAME)
                    .map(name => {
                        console.log('删除旧缓存:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim()) // 立即控制所有页面
    );
});

// 接收页面消息，手动触发更新
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 拦截请求 - 对 HTML 使用 Network First，其他使用 Cache First
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // HTML 文件使用 Network First 策略（确保获取最新版本）
    if (event.request.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // 更新缓存
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // 网络失败时使用缓存
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 其他资源使用 Cache First 策略
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then(response => {
                        // 不缓存非成功响应
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        // 克隆响应用于缓存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
    );
});
