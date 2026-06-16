export default {
  webpack: (config, { dev }) => {
    if (dev) {
      // kubectl cp (used by Skaffold sync) doesn't trigger inotify events,
      // so we use polling to detect file changes in the container.
      config.watchOptions = { poll: 300, aggregateTimeout: 300 };
    }
    return config;
  }
};
