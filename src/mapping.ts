import { SummonComplete, SubmitProposal, SubmitVote, ProcessProposal, UpdateDelegateKey, SponsorProposal, ProcessWhitelistProposal, ProcessGuildKickProposal } from "../generated/Moloch/Moloch";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";
import { Moloch, Member, Token, TokenBalance, Proposal, Vote } from '../generated/schema'

const ESCROW = Address.fromHexString("0xDEAD");
const GUILD = Address.fromHexString("0xBEEF");

function addToBalance(molochId:string, member:Address, token:Address, amount:BigInt) {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let tokenBalanceId = tokenId.concat("-member-").concat(member.toHex());
  let tokenBalance =  TokenBalance.load(tokenBalanceId);
  const addToBalanceSpell = {
    tokenBalance: tokenBalance.tokenBalance.plus(amount)
  }
  tokenBalance = Object.assign({}, tokenBalance, addToBalanceSpell);
  tokenBalance.save();
  return tokenBalanceId;
}
function subtractFromBalance(molochId:string, member:Address, token:Address, amount:BigInt) {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let tokenBalanceId = tokenId.concat("-member-").concat(member.toHex());
  let tokenBalance =  TokenBalance.load(tokenBalanceId);
  const subtractFromBalanceSpell = {
    tokenBalance: tokenBalance.tokenBalance.minus(amount)
  }
  tokenBalance = Object.assign({}, tokenBalance, subtractFromBalanceSpell);
  tokenBalance.save();
  return tokenBalanceId;
}
function internalTransfer(molochId:string, from:Address, to:Address, token:Address, amount:BigInt) {
  subtractFromBalance(molochId, from, token, amount);
  addToBalance(molochId, to, token, amount);
}
function createEscrowTokenBalance(token:Address, molochId:string, amount:BigInt):string {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let escrowTokenBalanceId = tokenId.concat("-member-").concat("0xDEAD");
  let escrowTokenBalance = new TokenBalance(escrowTokenBalanceId);
  const escrowTokenBalanceSpell = {
    moloch: molochId,
    token: tokenId,
    tokenBalance: BigInt.fromI32(0),
    guildBank: false,
    ecrowBank: true,
    memberBank: false
  }
  escrowTokenBalance = Object.assign({}, escrowTokenBalance, escrowTokenBalanceSpell);
  escrowTokenBalance.save();
  return escrowTokenBalanceId;
}
function createGuildTokenBalance(token:Address, molochId:string, amount:BigInt):string {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let guildTokenBalanceId = tokenId.concat("-member-").concat("0xBEEF");
  let guildTokenBalance = new TokenBalance(guildTokenBalanceId);
  const guildTokenBalanceSpell = {
    moloch: molochId,
    token: tokenId,
    tokenBalance: BigInt.fromI32(0),
    guildBank: true,
    ecrowBank: false,
    memberBank: false
  }
  guildTokenBalance = Object.assign({}, guildTokenBalance, guildTokenBalanceSpell);
  guildTokenBalance.save();
  return guildTokenBalanceId;
}
function createAndApproveToken(token:Address, molochId:string):string {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let approvedToken = new Token(tokenId);
  const tokenSpell = {
    moloch:molochId,
    tokenAddress:token,
    whitelisted:true  
  }
  approvedToken = Object.assign({}, approvedToken, tokenSpell);
  approvedToken.save();
  return tokenId;
}

// DONE - event: SummonComplete(indexed address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,address[])
// handler: handleSummonComplete
export function handleSummonComplete(event: SummonComplete): void {
  const molochId = event.address.toHex();
  let moloch = new Moloch(molochId);
  const {summoner,summoningTime,periodDuration,votingPeriodLength,gracePeriodLength, proposalDeposit,dilutionBound,processingReward,depositToken,tokens} = event.params;
  let approvedTokens = tokens.map((token)=>{ return createAndApproveToken(token, molochId)})
  let escrowTokenBalance = tokens.map((token)=>{ return createEscrowTokenBalance(token, molochId, BigInt.fromI32(0))})
  let guildTokenBalance = tokens.map((token)=>{ return createGuildTokenBalance(token, molochId, BigInt.fromI32(0))})

  const daoSpell = {
    summoner,
    summoningTime,
    periodDuration,
    votingPeriodLength,
    gracePeriodLength, 
    proposalDeposit,
    dilutionBound,
    processingReward,
    depositToken,
    guildTokenBalance: guildTokenBalance,
    escrowTokenBalance: escrowTokenBalance,
    currentPeriod: 0,
    totalShares:1,
    totalLoot:0,
    proposalCount:0,
    proposalQueueCount:0,
    proposedToJoin:new Array<string>(),
    proposedToWhitelist:new Array<string>(),
    proposedToKick:new Array<string>(),
    proposedToFund:new Array<string>()
  };
  moloch = Object.assign({}, moloch, daoSpell);
  moloch.save();

  const memberId = molochId.concat("-member-").concat(summoner.toHex());
  let member = new Member(memberId);
  const userSpell = {
    moloch: molochId,
    memberAddress: summoner,
    delegateKey: summoner,
    shares: 1,
    loot: 0,
    exists: true,
    highestIndexYesVote: 0,
    tokenTribute: 0,
    didRagequit: false,
    proposedToKick:false
  };
  member = Object.assign({}, member, userSpell);
  member.save();
}

// TODO - event: SubmitProposal(uint256,indexed address,indexed address,indexed address,uint256,uint256,uint256,address,uint256,address)
// handler: handleSubmitProposal
export function handleSubmitProposal(event: SubmitProposal):void {
  const molochId = event.address.toHex();
  const {proposalIndex, delegateKey, memberAddress, applicant, sharesRequested, lootRequested, tributeOffered, tributeToken, paymentRequested, paymentToken,flags,details} = event.params;
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const newMember = Member.load(molochId.concat("-member-").concat(applicant.toHex()))?false:true;

  let proposal = new Proposal(proposalId);
  const proposalSpell = {
    proposalIndex,
    moloch: molochId,
    timestamp: event.block.timestamp.toString(),
    member: memberId,
    memberAddress,
    delegateKey,

    applicant,
    proposer : event.transaction.from,
    sponsor : Address.fromI32(0),
    sharesRequested,
    lootRequested,
    tributeOffered,
    tributeToken,
    paymentRequested,
    paymentToken,
    startingPeriod : 0,
    yesVotes : 0,
    noVotes : 0,
    sponsored: flags[0],
    processed: flags[1],
    didPass:   flags[2],
    cancelled: flags[3],
    whitelist: flags[4],
    guildkick: flags[5],
    newMember,
    details,
    maxTotalSharesAndLootAtYesVote : 0,

    yesShares: 0,
    noShares: 0

  };
  proposal = Object.assign({}, proposal, proposalSpell);
  proposal.save();

}

// TODO - event: SubmitVote(indexed uint256,indexed address,indexed address,uint8)
// handler: handleSubmitVote
export function handleSubmitVote(event: SubmitVote):void{
  const { proposalIndex, delegateKey, memberAddress, uintVote} = event.params;
  const molochId = event.address.toHex();
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());
  const voteId = memberId.concat("-vote-").concat(proposalIndex.toString());
  
  let vote = new Vote(voteId);

  const voteSpell = {
    timestamp: event.block.timestamp.toString(),
    proposal: proposalId,
    memberId,
    uintVote
  }

  
  let moloch = Moloch.load(molochId);
  let proposal = Proposal.load(proposalId);
  let member = Member.load(memberId);
  switch(Number(uintVote)){
    case(1): {
      //NOTE: Vote.yes
      proposal.yesShares = proposal.yesShares.plus(member.shares);
      proposal.yesVotes = proposal.yesVotes.plus(BigInt.fromI32(1));
      proposal.maxTotalSharesAndLootAtYesVote = moloch.totalLoot.plus(moloch.totalShares);

      member.highestIndexYesVote = proposalIndex;
      proposal.save();
      member.save();
      break; 
    }
    case(2):{
      proposal.noShares = proposal.noShares.plus(member.shares);
      proposal.noVotes = proposal.noVotes.plus(BigInt.fromI32(1));
      proposal.save();
      break;
    }
    default:{
      //TODO: LOG AN ERROR, SHOULD BE A DEAD END CHECK uintVote INVARIANT IN CONTRACT
      break;
    }
  }
}

// TODO - event: SponsorProposal(indexed address,indexed address,uint256,uint256,uint256)
// handler: handleSponsorProposal
export function SponsorProposal(event:SponsorProposal):void{
  const {delegateKey, memberAddress, proposalIndex, proposalQueueIndex, startingPeriod} = event.params;
  const molochId = event.address.toHex();
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());

  const moloch = Moloch.load(molochId);
  const {depositToken, proposalDeposit} = moloch;
  addToBalance(molochId, ESCROW, depositToken, proposalDeposit);

  let proposal = Proposal.load(proposalId);
  const {whitelist, guildkick, newMember} = proposal;

  if (newMember){
    const memberProposals:string[] = [].concat(moloch.proposedToJoin, proposalId);
    moloch.proposedToJoin = memberProposals;
    moloch.save()
  } 
  else if (whitelist){
    const whitelistProposals:string[] = [].concat(moloch.proposedToWhitelist, proposalId);
    moloch.proposedToWhitelist = whitelistProposals;
    moloch.save()
  } 
  else if(guildkick){
    const guildkickProposals:string[] = [].concat(moloch.proposedToKick, proposalId);
    moloch.proposedToKick = guildkickProposals;
    moloch.save()
  } 
  else {
    const projectProposals:string[] = [].concat(moloch.proposedToFund, proposalId);
    moloch.proposedToFund = projectProposals;
    moloch.save()
  }

  const sponsorProposalSpell = {
    proposalQueueIndex,
    sponsor : memberAddress,
    startingPeriod,
    sponsored: true
    
  };
  proposal = Object.assign({}, proposal, sponsorProposalSpell);
  proposal.save();

}

// - event: ProcessProposal(indexed uint256,indexed uint256,bool)
// handler: handleProcessProposal
export function handleProcessProposal(event: ProcessProposal):void{
  const {proposalIndex, proposalId, didPass} = event.params;

  const molochId = event.address.toHex();
  let moloch = Moloch.load(molochId);
  const {totalShares, totalLoot, depositToken,processingReward, proposalDeposit} = moloch;

  const processProposalId = molochId.concat("-proposal-").concat(proposalId.toString());
  let  proposal = Proposal.load(processProposalId);
  const {applicant, sharesRequested, lootRequested, tributeToken, tributeOffered, paymentToken, paymentRequested, sponsor} = proposal;

  const applicantId = molochId.concat("-member-").concat(applicant.toHex());
  let member = Member.load(applicantId);
  const isNewMember = member && member.exists ? false :true;


  //NOTE: PROPOSAL PASSED
  if (didPass) {
    proposal.didPass = true;

    //CREATE MEMBER
    if(isNewMember) {
      let newMember = new Member(applicantId)
      const userSpell = {
        moloch: molochId,
        memberAddress: applicant,
        delegateKey: applicant,
        shares: sharesRequested,
        loot: lootRequested,
        exists: true,
        highestIndexYesVote: 0,
        tokenTribute: 0,
        didRagequit: false,
        proposedToKick:false
      };
      newMember = Object.assign({}, newMember, userSpell);
      newMember.save();

    //FUND PROPOSAL
    } else {
      member.shares = member.shares.plus(sharesRequested);
      member.loot = member.loot.plus(lootRequested);
      member.save();
    }
    //NOTE: Add shares/loot do intake tribute from escrow, payout from guild bank
    moloch.totalShares = totalShares.plus(sharesRequested);
    moloch.totalLoot = totalLoot.plus(lootRequested);
    internalTransfer(molochId,ESCROW, GUILD,tributeToken, tributeOffered)
    internalTransfer(molochId,GUILD, applicant,paymentToken, paymentRequested)

  //NOTE: PROPOSAL FAILED
  } else {
    proposal.didPass = false;
    // return all tokens to the applicant
    internalTransfer(molochId, ESCROW, applicant, tributeToken,tributeOffered);
  }

  //NOTE: issue processing reward and return deposit
  internalTransfer(molochId, ESCROW, event.transaction.from, depositToken, processingReward);
  internalTransfer(molochId, ESCROW, sponsor, depositToken, proposalDeposit.minus(processingReward));
  
  moloch.save();
  proposal.save();

}

// - event: ProcessGuildKickProposal(indexed uint256,indexed uint256,bool)
// handler: handleProcessGuildKickProposal
export function handleProcessWhitelistProposal(event:ProcessWhitelistProposal):void{

}

// - event: ProcessWhitelistProposal(indexed uint256,indexed uint256,bool)
// handler: handleProcessWhitelistProposal
export function handleProcessGuildKickProposal(event:ProcessGuildKickProposal):void{
  
}

// TODO - event: UpdateDelegateKey(indexed address,address)
// handler: handleUpdateDelegateKey



