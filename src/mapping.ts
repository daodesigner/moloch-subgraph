import { SummonComplete, SubmitProposal, SubmitVote, ProcessProposal, UpdateDelegateKey, SponsorProposal, ProcessWhitelistProposal, ProcessGuildKickProposal } from "../generated/Moloch/Moloch";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";
import { Moloch, Member, Token, TokenBalance, Proposal, Vote } from '../generated/schema'

interface DaoSpell {
  summoner: Address;
  summoningTime: BigInt;
  periodDuration: BigInt;
  votingPeriodLength: BigInt;
  gracePeriodLength: BigInt;
  proposalDeposit: BigInt;
  dilutionBound: BigInt;
  processingReward: BigInt;
  depositToken:string;
  approvedTokens: string[];
  guildTokenBalance: string[];
  escrowTokenBalance: string[];
  currentPeriod: BigInt;
  totalShares: BigInt;
  totalLoot: BigInt;
  proposalCount: BigInt;
  proposalQueueCount: BigInt;
  proposedToJoin: string[];
  proposedToWhitelist: string[];
  proposedToKick: string[];
  proposedToFund: string[];
  proposedToTrade: string[];
}

interface GuildTokenBalanceSpell {
  moloch: string;
  token: string;
  tokenBalance: BigInt;
  member:string;
  guildBank: true;
  ecrowBank: false;
  memberBank: false;
}
interface MemberTokenBalanceSpell{
  moloch: string;
  token: string;
  tokenBalance: BigInt;
  member:string;
  guildBank: false;
  ecrowBank: false;
  memberBank: true;
}

interface EscrowTokenBalanceSpell {
  moloch: string;
  token: string;
  tokenBalance: BigInt;
  member:string;
  guildBank: false;
  ecrowBank: true;
  memberBank: false;
}

interface UserSpell{
  moloch: string;
  memberAddress: Address;
  delegateKey: Address;
  shares: BigInt;
  loot: BigInt;
  exists: boolean;
  tokenTribute: BigInt;
  didRagequit: boolean;
  proposedToKick: boolean;
}

interface BalanceSpell{
  tokenBalance: BigInt;
}

interface NewTokenSpell{
  moloch: string;
  tokenAddress: Address;
  whitelisted: boolean;
}

interface ProposalSpell{
  proposalIndex: BigInt;
  moloch: string;
  timestamp: string;
  member: string;
  memberAddress: Address;
  delegateKey: Address;
  applicant: Address;
  proposer: Address;
  sponsor: Address;
  sharesRequested: BigInt;
  lootRequested: BigInt;
  tributeOffered: BigInt;
  tributeToken: Address;
  paymentRequested: BigInt;
  paymentToken: Address;
  startingPeriod: BigInt;
  yesVotes: BigInt;
  noVotes: BigInt;
  sponsored: boolean;
  processed: boolean;
  didPass: boolean;
  cancelled: boolean;
  whitelist: boolean;
  guildkick: boolean;
  newMember: boolean;
  trade: boolean;
  details: string;
  maxTotalSharesAndLootAtYesVote: BigInt;
  yesShares: BigInt;
  noShares: BigInt;
}

interface VoteSpell{
  timestamp: string;
  proposal: string;
  member: string;
  uintVote: any;
}

interface SponsorProposalSpell{
  proposalQueueIndex: BigInt;
  sponsor: Address;
  startingPeriod: BigInt;
  sponsored: boolean;
}


const ESCROW:Address = Address.fromHexString("0xDEAD");
const GUILD:Address = Address.fromHexString("0xBEEF");

function loadOrCreateTokenBalance(molochId:string, member:Address, token:Address):TokenBalance {
  const tokenId = molochId.concat("-token-").concat(token.toHex());
  const memberTokenBalanceId = tokenId.concat("-member-").concat(member.toHex());
  let tokenBalance =  TokenBalance.load(memberTokenBalanceId);
  const tokenBalanceDNE = tokenBalance?true:false;
  if(tokenBalanceDNE){
    createMemberTokenBalance(molochId,member,token,BigInt.fromI32(0))
    return TokenBalance.load(memberTokenBalanceId);
  }else {
    return tokenBalance
  }

}

function addToBalance(molochId:string, member:Address, token:Address, amount:BigInt) {
  const tokenId = molochId.concat("-token-").concat(token.toHex());
  const tokenBalanceId = tokenId.concat("-member-").concat(member.toHex());
  let tokenBalance:TokenBalance = loadOrCreateTokenBalance(molochId,member,token);
  const addToBalanceSpell:BalanceSpell = {
    //TODO:rename to avoid stutter
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
  const subtractFromBalanceSpell:BalanceSpell = {
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
function createMemberTokenBalance( molochId:string, member:Address, token:Address, amount:BigInt ):string {
  const memberId = molochId.concat("-member-").concat(member.toHex());
  const tokenId = molochId.concat("-token-").concat(token.toHex());
  const memberTokenBalanceId = tokenId.concat("-member-").concat(member.toHex());
  let memberTokenBalance = new TokenBalance(memberTokenBalanceId);
  const memberTokenBalanceSpell:MemberTokenBalanceSpell = {
    moloch: molochId,
    token: tokenId,
    tokenBalance: amount,
    member: memberId,
    guildBank: false,
    ecrowBank: false,
    memberBank: true,
  }
  memberTokenBalance = Object.assign({}, memberTokenBalance, memberTokenBalanceSpell);
  memberTokenBalance.save();
  return memberTokenBalanceId;
}
function createEscrowTokenBalance(molochId:string, token:Address):string {
  const memberId = molochId.concat("-member-").concat(ESCROW.toHex());
  const tokenId = molochId.concat("-token-").concat(token.toHex());
  const escrowTokenBalanceId = tokenId.concat("-member-").concat(ESCROW.toHex());
  let escrowTokenBalance = new TokenBalance(escrowTokenBalanceId);
  const escrowTokenBalanceSpell:EscrowTokenBalanceSpell = {
    moloch: molochId,
    token: tokenId,
    tokenBalance: BigInt.fromI32(0),
    member: memberId,
    guildBank: false,
    ecrowBank: true,
    memberBank: false,
  }
  escrowTokenBalance = Object.assign({}, escrowTokenBalance, escrowTokenBalanceSpell);
  escrowTokenBalance.save();
  return escrowTokenBalanceId;
}
function createGuildTokenBalance(molochId:string, token:Address):string {
  const memberId = molochId.concat("-member-").concat(GUILD.toHex());
  const tokenId = molochId.concat("-token-").concat(token.toHex());
  const guildTokenBalanceId = tokenId.concat("-member-").concat(GUILD.toHex());
  let guildTokenBalance = new TokenBalance(guildTokenBalanceId);
  const guildTokenBalanceSpell:GuildTokenBalanceSpell = {
    moloch: molochId,
    token: tokenId,
    tokenBalance: BigInt.fromI32(0),
    member:memberId,
    guildBank: true,
    ecrowBank: false,
    memberBank: false
  }
  guildTokenBalance = Object.assign({}, guildTokenBalance, guildTokenBalanceSpell);
  guildTokenBalance.save();
  return guildTokenBalanceId;
}
function createAndApproveToken( molochId:string, token:Address):string {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let createToken = new Token(tokenId);
  const tokenSpell:NewTokenSpell = {
    moloch:molochId,
    tokenAddress:token,
    whitelisted:true  
  }
  createToken = Object.assign({}, createToken, tokenSpell);
  createToken.save();
  return tokenId;
}

// DONE - event SummonComplete(address indexed summoner, address[] tokens, uint256 summoningTime, uint256 periodDuration, uint256 votingPeriodLength, uint256 gracePeriodLength, uint256 proposalDeposit, uint256 dilutionBound, uint256 processingReward);

// handler: handleSummonComplete
export function handleSummonComplete(event: SummonComplete): void {
  const molochId = event.address.toHex();
  let moloch = new Moloch(molochId);
  const {summoner,summoningTime,tokens, periodDuration,votingPeriodLength,gracePeriodLength, proposalDeposit,dilutionBound,processingReward} = event.params;
  let approvedTokens = tokens.map((token)=>{ return createAndApproveToken( molochId, token )})
  let escrowTokenBalance = tokens.map((token)=>{ return createEscrowTokenBalance(molochId, token)})
  let guildTokenBalance = tokens.map((token)=>{ return createGuildTokenBalance(molochId, token)})

  // Start new Moloch instance
  const daoSpell:DaoSpell = {
    summoner,
    summoningTime,
    periodDuration,
    votingPeriodLength,
    gracePeriodLength, 
    proposalDeposit,
    dilutionBound,
    processingReward,
    depositToken: approvedTokens[0],
    approvedTokens,
    guildTokenBalance: guildTokenBalance,
    escrowTokenBalance: escrowTokenBalance,
    currentPeriod: BigInt.fromI32(0),
    totalShares: BigInt.fromI32(1),
    totalLoot: BigInt.fromI32(0),
    proposalCount: BigInt.fromI32(0),
    proposalQueueCount: BigInt.fromI32(0),
    proposedToJoin:new Array<string>(),
    proposedToWhitelist:new Array<string>(),
    proposedToKick:new Array<string>(),
    proposedToFund:new Array<string>(),
    proposedToTrade:new Array<string>()
  };
  moloch = Object.assign({}, moloch, daoSpell);
  moloch.save();

  //Create member foir summoner
  const memberId = molochId.concat("-member-").concat(summoner.toHex());
  let newMember = new Member(memberId);
  const userSpell:UserSpell = {
    moloch: molochId,
    memberAddress: summoner,
    delegateKey: summoner,
    shares: BigInt.fromI32(1),
    loot: BigInt.fromI32(0),
    exists: true,
    tokenTribute: BigInt.fromI32(0),
    didRagequit: false,
    proposedToKick:false
  };
  newMember = Object.assign({}, newMember, userSpell);
  newMember.save();
  //Set summoner summoner balances for approved tokens to zero 
  const newMemberTokenBalances = tokens.map((token)=>{ return createMemberTokenBalance(molochId, summoner, token, BigInt.fromI32(0))})

}

// TODO - event: event SubmitProposal(uint256 proposalIndex, address indexed delegateKey, address indexed memberAddress, address indexed applicant, uint256 sharesRequested, uint256 lootRequested, uint256 tributeOffered, address tributeToken, uint256 paymentRequested, address paymentToken, bool[6] flags, string details);
// handler: handleSubmitProposal
export function handleSubmitProposal(event: SubmitProposal):void {
  const molochId = event.address.toHex();
  const {proposalIndex, delegateKey, memberAddress, applicant, sharesRequested, lootRequested, tributeOffered, tributeToken, paymentRequested, paymentToken,flags,details} = event.params;
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const newMember = Member.load(molochId.concat("-member-").concat(applicant.toHex()))?false:true;
  // For trades, members deposit tribute in the token they want to sell to the dao, and request payment in the token they wish to receive.
  const trade =  paymentToken && tributeToken && tributeOffered > BigInt.fromI32(0) && paymentRequested > BigInt.fromI32(0);

  let proposal = new Proposal(proposalId);
  const proposalSpell:ProposalSpell = {
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
    startingPeriod : BigInt.fromI32(0),
    yesVotes : BigInt.fromI32(0),
    noVotes : BigInt.fromI32(0),
    sponsored: flags[0],
    processed: flags[1],
    didPass:   flags[2],
    cancelled: flags[3],
    whitelist: flags[4],
    guildkick: flags[5],
    newMember,
    trade,
    details,
    maxTotalSharesAndLootAtYesVote : BigInt.fromI32(0),

    yesShares: BigInt.fromI32(0),
    noShares: BigInt.fromI32(0)

  };
  proposal = Object.assign({}, proposal, proposalSpell);
  proposal.save();

  // collect tribute from proposer and store it in Moloch ESCROW until the proposal is processed
  if(tributeOffered > BigInt.fromI32(0)){
    addToBalance(molochId, ESCROW, tributeToken, tributeOffered);
  }
  
}

// TODO - event: SubmitVote(indexed uint256,indexed address,indexed address,uint8)
// handler: handleSubmitVote
export function handleSubmitVote(event: SubmitVote):void{
  const { proposalIndex, proposalQueueIndex, delegateKey, memberAddress, uintVote} = event.params;
  const molochId = event.address.toHex();
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());
  const voteId = memberId.concat("-vote-").concat(proposalIndex.toString());
  
  let vote = new Vote(voteId);

  const voteSpell: VoteSpell = {
    timestamp: event.block.timestamp.toString(),
    proposal: proposalId,
    member:memberId,
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
      //NOTE: Set maximum of total shares encountered at a yes vote - used to bound dilution for yes voters
      proposal.maxTotalSharesAndLootAtYesVote = moloch.totalLoot.plus(moloch.totalShares);
      //NOTE: Set highest index (latest) yes vote - must be processed for member to ragequit
      member.highestIndexYesVote = proposalId;
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

// TODO - event SponsorProposal(address indexed delegateKey, address indexed memberAddress, uint256 proposalIndex, uint256 proposalQueueIndex, uint256 startingPeriod);
// handler: handleSponsorProposal
export function handleSponsorProposal(event:SponsorProposal):void{
  const {delegateKey, memberAddress, proposalIndex, proposalQueueIndex, startingPeriod} = event.params;
  const molochId = event.address.toHex();
  const memberId = molochId.concat("-member-").concat(memberAddress.toHex());
  const proposalId = molochId.concat("-proposal-").concat(proposalIndex.toString());

  const moloch = Moloch.load(molochId);
  const {depositToken, proposalDeposit} = moloch;

  // collect proposal deposit from sponsor and store it in the Moloch until the proposal is processed
  addToBalance(molochId, ESCROW, depositToken, proposalDeposit);

  let proposal = Proposal.load(proposalId);
  const {whitelist, guildkick, newMember, trade} = proposal;

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
  else if (trade){
    const tradeProposals:string[] = [].concat(moloch.proposedToTrade, proposalId);
    moloch.proposedToTrade = tradeProposals;
    moloch.save()
  }
  else {
    const projectProposals:string[] = [].concat(moloch.proposedToFund, proposalId);
    moloch.proposedToFund = projectProposals;
    moloch.save()
  }

  const sponsorProposalSpell:SponsorProposalSpell = {
    proposalQueueIndex,
    sponsor : memberAddress,
    startingPeriod,
    sponsored: true
    
  };
  proposal = Object.assign({}, proposal, sponsorProposalSpell);
  proposal.save();

}

// TODO - event ProcessProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
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
      const userSpell:UserSpell = {
        moloch: molochId,
        memberAddress: applicant,
        delegateKey: applicant,
        shares: sharesRequested,
        loot: lootRequested,
        exists: true,
        tokenTribute: BigInt.fromI32(0),
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
    //TODO: check if user has a tokenBalance for that token if not then create one before sending
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


// event ProcessWhitelistProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
// event ProcessGuildKickProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
// event Ragequit(address indexed memberAddress, uint256 sharesToBurn, uint256 lootToBurn);
// event CancelProposal(uint256 indexed proposalIndex, address applicantAddress);
// event UpdateDelegateKey(address indexed memberAddress, address newDelegateKey);


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



