module.exports = {
    lookup: (hostname, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      callback(null, '127.0.0.1', 4);
    },
    resolve: (hostname, rrtype, callback) => {
      if (typeof rrtype === 'function') {
        callback = rrtype;
        rrtype = 'A';
      }
      callback(null, ['127.0.0.1']);
    }
  };