const authUserPath = require.resolve('./lib/authUser')

require.cache[authUserPath] = {
  id: authUserPath,
  filename: authUserPath,
  loaded: true,
  exports: {
    verifySession: async () => null,
    invalidateAuthUser: () => {},
  },
}
