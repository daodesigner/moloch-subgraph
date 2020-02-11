const Token = artifacts.require("Token");
const Moloch = artifacts.require('Moloch');

const deploymentConfig = {
  TOKEN_SUPPLY: '100000000000000000000',
  SUMMONER: '0x8eC75ef3aDf6C953775d0738e0E7BD60E647E5Ef',
  PERIOD_DURATION_IN_SECONDS: 60,
  VOTING_DURATON_IN_PERIODS: 3,
  GRACE_DURATON_IN_PERIODS: 3,
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
  


