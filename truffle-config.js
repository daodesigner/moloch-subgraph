require('dotenv').config()
require('babel-register')
require('babel-polyfill')
const HDWalletProvider = require('@truffle/hdwallet-provider')

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      gas: 9721975, // <-- Use this high gas value
      gasPrice: 1000000000,    // <-- Use this low gas price
      network_id: '*', // Match any network id
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          `https://kovan.infura.io/v3/${process.env.ROPSTEN_INFURA_API_KEY}`
        )
      },
      network_id: '42',
    },
  },
  compilers: {
    
    solc: {
      version: '0.5.3',
      evmVersion: 'constantinople',
      settings: {
        optimizer: {
          enabled: true, // Default: false
          runs: 2000      // Default: 200
        },
      }
      
    }
  }
}
