# moloch-subgraph
Moloch V2 Subgraph for The Agency


![](facesofmoloch_sr.gif)


Welcome to FlatLand:
http://manifesto.designerdao.eth.link/


**Broke**: graphprotocol is an event sourced database. You write handlers that are triggered by events that smart contracts fire, and contain biz logic which in turn writes state changes to a SQL database.

(the logic is essentially transpiling the Moloch contract logic to TS so should look familiar)

The SQL Data is exposed as entities defined in a gql schema file and served from a GraphQL endpoint exposed by the GraphProtocol which can be queried using the graphqlAPI

**Woke**: 
1) Clone the repo and create a GraphProtocol account
2) Grab access token from dashboard, create a new subgraph
3) cd into the repo and login on the cli using access token
3) Set up truffle config and .env file for keys you'll use and network/infura endpoint
4) Set up deploy config on migration file and run: truffle deploy <network>
5) Add contract address to subgraph config
6) Modify package.json to deploy to your subgraph from (2)
7) yarn deploy
8) Go to the subgraph explorer and type this into the query field:
```{
  moloches(first: 1) {
    totalLoot
    totalShares
    summoner
    summoningTime
    depositToken{
      tokenAddress
    }
    members{
      memberAddress
      delegateKey
      shares
      loot
      tokenTribute
      didRagequit
      tokenBalances{
        token {
       tokenAddress
       whitelisted
     }
     tokenBalance
      }
    }
    proposals{
      proposalId
      proposalIndex
      applicant
      memberAddress
      proposer
      proposer
      sponsored
      sponsor
      sharesRequested
      lootRequested
      tributeOffered
      paymentRequested
      paymentToken
      startingPeriod
      tributeToken
      yesShares
      noShares
      newMember
      trade
      whitelist
      guildkick
      cancelled
      details
    }
    guildTokenBalance{
      token {
       tokenAddress
       whitelisted
     }
     tokenBalance
    }
    escrowTokenBalance{
      token {
       tokenAddress
       whitelisted
     }
     tokenBalance
    }
  }
}```
9) Hit run
10) Grab the graphQL endpoint from subgraph explorer and query on dapp using something like Apollo
11) ???
12) Profit
