const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://192.168.1.111:3000',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // strip '/api' from the request path
      },
    })
  );
};

