const Token = artifacts.require("Token");
const Moloch = artifacts.require('Moloch');

const deploymentConfig = {
  TOKEN_SUPPLY: '100000000000000000000',
  SUMMONER: '0x8ec75ef3adf6c953775d0738e0e7bd60e647e5ef',
  PERIOD_DURATION_IN_SECONDS: 17280,
  VOTING_DURATON_IN_PERIODS: 35,
  GRACE_DURATON_IN_PERIODS: 35,
  PROPOSAL_DEPOSIT: '1000000000000000000', // Large numbers should be string or big numbers,
  DILUTION_BOUND: 3,
  PROCESSING_REWARD: '10000000000'
}



module.exports = function(deployer) {

  deployer.deploy(Token,
    '100000000000000000000'
  ).then(function() {
    return  deployer.deploy(Moloch,
      deploymentConfig.SUMMONER,
      [Token.address],
      deploymentConfig.PERIOD_DURATION_IN_SECONDS,
      deploymentConfig.VOTING_DURATON_IN_PERIODS,
      deploymentConfig.GRACE_DURATON_IN_PERIODS,
      deploymentConfig.PROPOSAL_DEPOSIT,
      deploymentConfig.DILUTION_BOUND,
      deploymentConfig.PROCESSING_REWARD
    )
    }
  )
};
  


