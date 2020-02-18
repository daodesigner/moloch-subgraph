import { SummonComplete, SubmitProposal, SubmitVote, ProcessProposal, UpdateDelegateKey, SponsorProposal, ProcessWhitelistProposal, ProcessGuildKickProposal, Ragequit, CancelProposal, Withdraw } from "../generated/Moloch/Moloch";
import { BigInt, log, Address, ByteArray, Bytes } from "@graphprotocol/graph-ts";
import { Moloch, Member, Token, TokenBalance, Proposal, Vote } from '../generated/schema'

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
let ESCROW = Address.fromString("0x000000000000000000000000000000000000dead");
let GUILD =  Address.fromString("0x000000000000000000000000000000000000beef");

function loadOrCreateTokenBalance(molochId:string, member:Bytes, token:string):TokenBalance|null {
  let memberTokenBalanceId = token.concat("-member-").concat(member.toHex());
  let tokenBalance =  TokenBalance.load(memberTokenBalanceId);
  let tokenBalanceDNE = tokenBalance == null ?true:false;
  if(tokenBalanceDNE){
    createMemberTokenBalance(molochId,member,token,BigInt.fromI32(0))
    return TokenBalance.load(memberTokenBalanceId);
  }else {
    return tokenBalance
  }

}
function addToBalance(molochId:string, member:Bytes, token:string, amount:BigInt):string {
  let tokenBalanceId = token.concat("-member-").concat(member.toHex());
  let balance:TokenBalance|null = loadOrCreateTokenBalance(molochId,member,token);
  balance.tokenBalance = balance.tokenBalance.plus(amount)
  balance.save();
  return tokenBalanceId;
}
function subtractFromBalance(molochId:string, member:Bytes, token:string, amount:BigInt):string {
  let tokenBalanceId = token.concat("-member-").concat(member.toHex());
  let balance:TokenBalance|null =  TokenBalance.load(tokenBalanceId);
  
  balance.tokenBalance = balance.tokenBalance.minus(amount)
  
  balance.save();
  return tokenBalanceId;
}

function internalTransfer(molochId:string, from:Bytes, to:Bytes, token:string, amount:BigInt):void {
  log.info("Value = {internalTransfer}, other = {}", [""])
  subtractFromBalance(molochId, from, token, amount);
  addToBalance(molochId, to, token, amount);
}
function createMemberTokenBalance( molochId:string, member:Bytes, token:string, amount:BigInt ):string {
  let memberId = molochId.concat("-member-").concat(member.toHex());
  let memberTokenBalanceId = token.concat("-member-").concat(member.toHex());
  let memberTokenBalance = new TokenBalance(memberTokenBalanceId);
  
  memberTokenBalance.moloch       = molochId;
  memberTokenBalance.token        = token;
  memberTokenBalance.tokenBalance = amount;
  memberTokenBalance.member       = memberId;
  memberTokenBalance.guildBank    = false;
  memberTokenBalance.ecrowBank    = false;
  memberTokenBalance.memberBank   = true;
  
  memberTokenBalance.save();
  return memberTokenBalanceId;
}
function createEscrowTokenBalance(molochId:string, token:Bytes):string {
  let memberId = molochId.concat("-member-").concat(ESCROW.toHex());
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let escrowTokenBalanceId = tokenId.concat("-member-").concat(ESCROW.toHex());
  let escrowTokenBalance = new TokenBalance(escrowTokenBalanceId);
  escrowTokenBalance.moloch       = molochId;
  escrowTokenBalance.token        = tokenId;
  escrowTokenBalance.tokenBalance = BigInt.fromI32(0);
  escrowTokenBalance.member       = memberId;
  escrowTokenBalance.guildBank    = false;
  escrowTokenBalance.ecrowBank    = true;
  escrowTokenBalance.memberBank   = false;
  
  escrowTokenBalance.save();
  return escrowTokenBalanceId;
}
function createGuildTokenBalance(molochId:string, token:Bytes):string {
  let memberId = molochId.concat("-member-").concat(GUILD.toHex());
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let guildTokenBalanceId = tokenId.concat("-member-").concat(GUILD.toHex());
  let guildTokenBalance = new TokenBalance(guildTokenBalanceId);
  
  guildTokenBalance.moloch      =  molochId;
  guildTokenBalance.token       =  tokenId;
  guildTokenBalance.tokenBalance=  BigInt.fromI32(0);
  guildTokenBalance.member      =  memberId;
  guildTokenBalance.guildBank   =  true;
  guildTokenBalance.ecrowBank   =  false;
  guildTokenBalance.memberBank  =  false;
  
  guildTokenBalance.save();
  return guildTokenBalanceId;
}
function createAndApproveToken( molochId:string, token:Bytes):string {
  let tokenId = molochId.concat("-token-").concat(token.toHex());
  let createToken = new Token(tokenId);

  createToken.moloch      = molochId;
  createToken.tokenAddress= token;
  createToken.whitelisted = true;
  
  createToken.save();
  return tokenId;
}

// DONE - event SummonComplete(address indexed summoner, address[] tokens, uint256 summoningTime, uint256 periodDuration, uint256 votingPeriodLength, uint256 gracePeriodLength, uint256 proposalDeposit, uint256 dilutionBound, uint256 processingReward);

// handler: handleSummonComplete
export function handleSummonComplete(event: SummonComplete): void {
  let molochId = event.address.toHex();
  let moloch = new Moloch(molochId);
  let tokens = event.params.tokens;

  let approvedTokens:string[] = [];
  let escrowTokenBalance:string[] = [];
  let guildTokenBalance:string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    approvedTokens.push( createAndApproveToken( molochId, token ) )
    escrowTokenBalance.push( createEscrowTokenBalance(molochId, token) )
    guildTokenBalance.push( createGuildTokenBalance(molochId, token) )
  }

  // Start new Moloch instance
  moloch.summoner = event.params.summoner;
  moloch.summoningTime = event.params.summoningTime;
  moloch.periodDuration = event.params.periodDuration; 
  moloch.votingPeriodLength = event.params.votingPeriodLength; 
  moloch.gracePeriodLength = event.params.gracePeriodLength;
  moloch.proposalDeposit = event.params.proposalDeposit; 
  moloch.dilutionBound = event.params.dilutionBound; 
  moloch.processingReward = event.params.processingReward; 
  moloch.depositToken =  approvedTokens[0];
  moloch.approvedTokens = approvedTokens;
  moloch.guildTokenBalance =  guildTokenBalance;
  moloch.escrowTokenBalance =  escrowTokenBalance;
  moloch.currentPeriod =  BigInt.fromI32(0);
  moloch.totalShares =  BigInt.fromI32(1);
  moloch.totalLoot =  BigInt.fromI32(0);
  moloch.proposalCount =  BigInt.fromI32(0);
  moloch.proposalQueueCount =  BigInt.fromI32(0);
  moloch.proposedToJoin = new Array<string>();
  moloch.proposedToWhitelist = new Array<string>();
  moloch.proposedToKick = new Array<string>();
  moloch.proposedToFund = new Array<string>();
  moloch.proposedToTrade = new Array<string>();
  
  
  moloch.save();

  //Create member foir summoner
  let memberId = molochId.concat("-member-").concat(event.params.summoner.toHex());
  let newMember = new Member(memberId);
  newMember.moloch        = molochId;
  newMember.memberAddress = event.params.summoner;
  newMember.delegateKey   = event.params.summoner;
  newMember.shares        = BigInt.fromI32(1);
  newMember.loot          = BigInt.fromI32(0);
  newMember.exists        = true;
  newMember.tokenTribute  = BigInt.fromI32(0);
  newMember.didRagequit   = false;
  newMember.proposedToKick= false;
  newMember.kicked        = false;

  newMember.save();
  //Set summoner summoner balances for approved tokens to zero 
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let tokenId =  molochId.concat("-token-").concat(token.toHex());
    createMemberTokenBalance(molochId, event.params.summoner, tokenId, BigInt.fromI32(0))
  }

}

// TODO - event SubmitProposal(address indexed applicant, uint256 sharesRequested, uint256 lootRequested, uint256 tributeOffered, address tributeToken, uint256 paymentRequested, address paymentToken, string details, bool[6] flags, uint256 proposalId, address indexed delegateKey, address indexed memberAddress);
// handler: handleSubmitProposal
export function handleSubmitProposal(event: SubmitProposal):void {
  let molochId = event.address.toHexString();
  
  let newProposalId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());
  let memberId = molochId.concat("-member-").concat(event.params.memberAddress.toHex());
  let newMember = Member.load(molochId.concat("-member-").concat(event.params.applicant.toHex())) == null?true:false;
  // For trades, members deposit tribute in the token they want to sell to the dao, and request payment in the token they wish to receive.
  let trade =  event.params.paymentToken != Address.fromI32(0) && event.params.tributeToken!= Address.fromI32(0) && event.params.tributeOffered > BigInt.fromI32(0) && event.params.paymentRequested > BigInt.fromI32(0);
  
  let flags = event.params.flags;

  let proposal = new Proposal(newProposalId);
  proposal.proposalId      = event.params.proposalId;
  proposal.moloch          = molochId;
  proposal.timestamp       = event.block.timestamp.toString();
  proposal.member          = memberId;
  proposal.memberAddress   = event.params.memberAddress;
  proposal.delegateKey     = event.params.delegateKey;
  proposal.applicant       = event.params.applicant;
  proposal.proposer        = event.transaction.from;
  proposal.sponsor         = Address.fromString(ZERO_ADDRESS);
  proposal.sharesRequested = event.params.sharesRequested;
  proposal.lootRequested   = event.params.lootRequested;
  proposal.tributeOffered  = event.params.tributeOffered;
  proposal.tributeToken    = event.params.tributeToken;
  proposal.paymentRequested= event.params.paymentRequested;
  proposal.paymentToken    = event.params.paymentToken;
  proposal.startingPeriod  = BigInt.fromI32(0);
  proposal.yesVotes        = BigInt.fromI32(0);
  proposal.noVotes         = BigInt.fromI32(0);
  proposal.sponsored       = flags[0];
  proposal.processed       = flags[1];
  proposal.didPass         = flags[2];
  proposal.cancelled       = flags[3];
  proposal.whitelist       = flags[4];
  proposal.guildkick       = flags[5];
  proposal.newMember       = newMember;
  proposal.trade           = trade;
  proposal.details         = event.params.details;
  proposal.yesShares       = BigInt.fromI32(0);
  proposal.noShares        = BigInt.fromI32(0);
  proposal.maxTotalSharesAndLootAtYesVote = BigInt.fromI32(0);

  proposal.save();

  // collect tribute from proposer and store it in Moloch ESCROW until the proposal is processed
  if(event.params.tributeOffered > BigInt.fromI32(0)){
    let tokenId =  molochId.concat("-token-").concat(event.params.tributeToken.toHex());
    addToBalance(molochId, ESCROW, tokenId, event.params.tributeOffered);
  }
  
}

// TODO - event SubmitVote(uint256 proposalId, uint256 indexed proposalIndex, address indexed delegateKey, address indexed memberAddress, uint8 uintVote);
// handler: handleSubmitVote
export function handleSubmitVote(event: SubmitVote):void{
  let molochId = event.address.toHexString();
  let memberId = molochId.concat("-member-").concat(event.params.memberAddress.toHex());
  let proposalVotedId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());
  let voteId = memberId.concat("-vote-").concat(event.params.proposalId.toString());
  
  let vote = new Vote(voteId);
  
  vote.timestamp = event.block.timestamp.toString();
  vote.proposal  = proposalVotedId;
  vote.member    = memberId;
  vote.uintVote  = event.params.uintVote;

  vote.save();
  let moloch = Moloch.load(molochId);
  let proposal = Proposal.load(proposalVotedId);
  let member = Member.load(memberId);

  switch(event.params.uintVote){
    case(1): {
      //NOTE: Vote.yes
      proposal.yesShares = proposal.yesShares.plus(member.shares);
      proposal.yesVotes = proposal.yesVotes.plus(BigInt.fromI32(1));
      //NOTE: Set maximum of total shares encountered at a yes vote - used to bound dilution for yes voters
      proposal.maxTotalSharesAndLootAtYesVote = moloch.totalLoot.plus(moloch.totalShares);
      //NOTE: Set highest index (latest) yes vote - must be processed for member to ragequit
      member.highestIndexYesVote = proposalVotedId;
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

// TODO - event SponsorProposal(address indexed delegateKey, address indexed memberAddress, uint256 proposalId, uint256 proposalIndex, uint256 startingPeriod);
// handler: handleSponsorProposal
export function handleSponsorProposal(event:SponsorProposal):void{
  let molochId = event.address.toHexString();
  let memberId = molochId.concat("-member-").concat(event.params.memberAddress.toHex());
  let sponsorProposalId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());

  let moloch = Moloch.load(molochId);


  // collect proposal deposit from sponsor and store it in the Moloch until the proposal is processed
  addToBalance(molochId, ESCROW, moloch.depositToken, moloch.proposalDeposit);

  let proposal = Proposal.load(sponsorProposalId);

  //TODO: Debug fails silently to add; array comprehensions probably not working
  if (proposal.newMember){
    moloch.proposedToJoin = moloch.proposedToJoin.concat([sponsorProposalId]);
    moloch.save()
  } 
  else if (proposal.whitelist){
    moloch.proposedToWhitelist = moloch.proposedToWhitelist.concat([sponsorProposalId]);
    moloch.save()
  } 
  else if(proposal.guildkick){
    moloch.proposedToKick = moloch.proposedToKick.concat([sponsorProposalId]);

    let member = Member.load(memberId);
    member.proposedToKick = true;
    member.save();
    moloch.save();

  } 
  else if (proposal.trade){
    moloch.proposedToTrade = moloch.proposedToTrade.concat([sponsorProposalId]);
    moloch.save()
  }
  else {
    moloch.proposedToFund = moloch.proposedToFund.concat([sponsorProposalId]);
    moloch.save()
  }

  proposal.proposalIndex = event.params.proposalIndex;
  proposal.sponsor       = event.params.memberAddress;
  proposal.startingPeriod= event.params.startingPeriod;
  proposal.sponsored     = true;

  proposal.save();

}

// TODO - event ProcessProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
// handler: handleProcessProposal
export function handleProcessProposal(event: ProcessProposal):void{

  let molochId = event.address.toHexString();
  let moloch = Moloch.load(molochId);

  let processProposalId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());
  let  proposal = Proposal.load(processProposalId);

  let applicantId = molochId.concat("-member-").concat(proposal.applicant.toHex());
  let member = Member.load(applicantId);

  let tributeTokenId =  molochId.concat("-token-").concat(proposal.tributeToken.toHex());
  let paymentTokenId =  molochId.concat("-token-").concat(proposal.paymentToken.toHex());


  let isNewMember = member != null && member.exists == true ? false :true;


  //NOTE: PROPOSAL PASSED
  if (event.params.didPass) {
    proposal.didPass = true;

    //CREATE MEMBER
    if(isNewMember) {
      let newMember = new Member(applicantId)

      newMember.moloch         = molochId;
      newMember.memberAddress  = proposal.applicant;
      newMember.delegateKey    = proposal.applicant;
      newMember.shares         = proposal.sharesRequested;
      newMember.loot           = proposal.lootRequested;
      newMember.exists         = true;
      newMember.tokenTribute   = BigInt.fromI32(0);
      newMember.didRagequit    = false;
      newMember.proposedToKick = false;
      newMember.kicked         = false;

      newMember.save();

    //FUND PROPOSAL
    } else {
      member.shares = member.shares.plus(proposal.sharesRequested);
      member.loot = member.loot.plus(proposal.lootRequested);
      member.save();
    }

    //NOTE: Add shares/loot do intake tribute from escrow, payout from guild bank
    moloch.totalShares = moloch.totalShares.plus(proposal.sharesRequested);
    moloch.totalLoot = moloch.totalLoot.plus(proposal.lootRequested);
    internalTransfer(molochId,ESCROW, GUILD,tributeTokenId, proposal.tributeOffered)
    //NOTE: check if user has a tokenBalance for that token if not then create one before sending
    internalTransfer(molochId,GUILD, proposal.applicant,paymentTokenId, proposal.paymentRequested)

  //NOTE: PROPOSAL FAILED
  } else {
    proposal.didPass = false;
    // return all tokens to the applicant
    
    internalTransfer(molochId, ESCROW, proposal.applicant, tributeTokenId ,proposal.tributeOffered);
  }

  //NOTE: fixed array comprehensions update ongoing proposals (that have been sponsored)
  if (proposal.trade) {
    //TODO:test
    moloch.proposedToTrade = moloch.proposedToTrade.filter(function(value, index, arr){return index > 0;});
    
  } else if(proposal.newMember){
    moloch.proposedToJoin = moloch.proposedToJoin.filter(function(value, index, arr){return index > 0;});
    
  } else {
    moloch.proposedToFund = moloch.proposedToFund.filter(function(value, index, arr){return index > 0;});
  }
  proposal.processed = true;
  

  //NOTE: issue processing reward and return deposit
  internalTransfer(molochId, ESCROW, event.transaction.from, moloch.depositToken, moloch.processingReward);
  internalTransfer(molochId, ESCROW, proposal.sponsor, moloch.depositToken, moloch.proposalDeposit.minus(moloch.processingReward));
  
  moloch.save();
  proposal.save();

}

// event ProcessWhitelistProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
// handler: handleProcessGuildKickProposal
export function handleProcessWhitelistProposal(event:ProcessWhitelistProposal):void{

  let molochId = event.address.toHexString();
  let moloch = Moloch.load(molochId);

  let processProposalId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());
  let  proposal = Proposal.load(processProposalId);

  let tokenId = molochId.concat("-token-").concat(proposal.tributeToken.toHex());
  let token = Token.load(tokenId);

  let isNotWhitelisted = token != null && token.whitelisted == true ? false :true;


  //NOTE: PROPOSAL PASSED
  if (event.params.didPass) {
    proposal.didPass = true;

    //CREATE Token
    //NOTE: invariant no loot no shares, 
    if(isNotWhitelisted) {
      createAndApproveToken(molochId, proposal.tributeToken)
      createEscrowTokenBalance(molochId, proposal.tributeToken);
      createGuildTokenBalance(molochId, proposal.tributeToken);
    }
    
  //NOTE: PROPOSAL FAILED
  } else {
    proposal.didPass = false;
    
  }
  //NOTE: can only process proposals in order.
  moloch.proposedToWhitelist = moloch.proposedToWhitelist.filter(function(value, index, arr){return index > 0;});
  proposal.processed = true;

  //NOTE: issue processing reward and return deposit
  internalTransfer(molochId, ESCROW, event.transaction.from, moloch.depositToken, moloch.processingReward);
  internalTransfer(molochId, ESCROW, proposal.sponsor, moloch.depositToken, moloch.proposalDeposit.minus(moloch.processingReward));
  
  moloch.save();
  proposal.save();


}

// event ProcessGuildKickProposal(uint256 indexed proposalIndex, uint256 indexed proposalId, bool didPass);
// handler: handleProcessWhitelistProposal
export function handleProcessGuildKickProposal(event:ProcessGuildKickProposal):void{

  let molochId = event.address.toHex();
  let moloch = Moloch.load(molochId);

  let processProposalId = molochId.concat("-proposal-").concat(event.params.proposalId.toString());
  let  proposal = Proposal.load(processProposalId);

  let tokenId = molochId.concat("-token-").concat(proposal.tributeToken.toHex());
  let token = Token.load(tokenId);

  //PROPOSAL PASSED
  //NOTE: invariant no loot no shares,
  if (event.params.didPass) {
    proposal.didPass = true;
    //Kick member
    if(proposal.guildkick) {
      let memberId = molochId.concat("-member-").concat(proposal.applicant.toString());
      let member = Member.load(memberId);
      let newLoot = member.shares;
      
      member.jailed = processProposalId;
      member.kicked = true;
      member.shares = BigInt.fromI32(0);
      member.loot   = member.loot.plus(newLoot);

      moloch.totalLoot.plus(newLoot);
      moloch.totalShares.minus(newLoot);

      member.save();
    }
    
  //PROPOSAL FAILED
  } else {
    proposal.didPass = false;
  }

  //NOTE: can only process proposals in order, test shift array comprehension might have tp sprt first for this to work
  moloch.proposedToKick = moloch.proposedToKick.filter(function(value, index, arr){return index > 0;});
  proposal.processed = true;

  //NOTE: issue processing reward and return deposit
  //TODO: fix to not use from address, could be a delegate emit member kwy from event
  internalTransfer(molochId, ESCROW, event.transaction.from, moloch.depositToken, moloch.processingReward);
  internalTransfer(molochId, ESCROW, proposal.sponsor, moloch.depositToken, moloch.proposalDeposit.minus(moloch.processingReward));
  
  moloch.save();
  proposal.save();

}

// event Ragequit(address indexed memberAddress, uint256 sharesToBurn, uint256 lootToBurn);
// handler: handleRagequit
export function handleRagequit(event:Ragequit):void{
  
}

// event CancelProposal(uint256 indexed proposalIndex, address applicantAddress);
// handler: handleCancelProposal
export function handleCancelProposal(event:CancelProposal):void{

}

// event UpdateDelegateKey(address indexed memberAddress, address newDelegateKey);
// handler: handleUpdateDelegateKey
export function handleUpdateDelegateKey(event:UpdateDelegateKey):void{
  
}

// event Withdraw(address indexed memberAddress, address token, uint256 amount);
// handler: handleWithdraw
export function handleWithdraw(event:Withdraw):void{

}



