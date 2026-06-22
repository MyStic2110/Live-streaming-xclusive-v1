import { createClient } from 'redis';
import crypto from 'crypto';
import { query as dbQuery } from '../config/db.js';
import logger from '../config/logger.js';

// Initialize a separate Redis client for the battle arena
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error(`[BATTLE_REDIS] Redis client error: ${err.message}`);
});

// Connect to Redis on module load
(async () => {
  try {
    await redisClient.connect();
    logger.info('[BATTLE_REDIS] ✅ Redis client connected for Matchmaking & Leaderboard.');
  } catch (err) {
    logger.error(`[BATTLE_REDIS] ❌ Redis connection failed: ${err.message}`);
  }
})();

// Active rooms state
const activeRooms = new Map();

// Helper to mask emails (GDPR compliant)
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 'anonymous@gmail.com';
  const [username, domain] = email.split('@');
  if (username.length <= 3) {
    return `${username.slice(0, 1)}***@${domain}`;
  }
  return `${username.slice(0, 3)}***@${domain}`;
};

// Call Mistral API for dynamic operations
async function callMistral(messages, jsonFormat = false) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured in environment variables.');
  }

  const body = {
    model: 'mistral-large-latest',
    messages
  };

  if (jsonFormat) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.ok ? '' : await response.text();
    throw new Error(`Mistral API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Generate dynamic question matching the role
async function generateQuestion(roleTitle, roleId, candidateEmails) {
  try {
    let staticQuestion = null;
    // ponytail: check for unanswered static PM questions first, only generate dynamically when exhausted
    if (roleId === 'ai-pm' && candidateEmails && candidateEmails.length > 0) {
      logger.info(`[BATTLE_AI] Checking static questions for role_id: ${roleId} and emails: ${candidateEmails}`);
      const queryText = `
        SELECT id, topic, question, grading_rubric, model_answer, role_id
        FROM battle_questions
        WHERE role_id = $1
          AND id NOT IN (
            SELECT question_id
            FROM battle_answered_questions
            WHERE email = ANY($2)
          )
        ORDER BY id ASC
        LIMIT 1;
      `;
      const dbResult = await dbQuery(queryText, ['ai-pm', candidateEmails]);
      if (dbResult.rows.length > 0) {
        staticQuestion = dbResult.rows[0];
        logger.info(`[BATTLE_AI] Found static question: ${staticQuestion.id} - ${staticQuestion.topic}`);
      } else {
        logger.info(`[BATTLE_AI] No unanswered static questions left. Falling back to dynamic generation.`);
      }
    }

    if (staticQuestion) {
      return {
        id: staticQuestion.id,
        title: staticQuestion.topic,
        description: staticQuestion.question,
        grading_rubric: staticQuestion.grading_rubric,
        model_answer: staticQuestion.model_answer,
        isStatic: true
      };
    }

    logger.info(`[BATTLE_AI] Generating dynamic question for role: ${roleTitle}`);
    const systemPrompt = `You are a world-class AI Engineering Interviewer. Generate one extremely challenging, open-ended system design or coding challenge for a candidate applying as: "${roleTitle}". 
Ensure the challenge is detailed, realistic, and has clear architectural or performance considerations.
Return ONLY a valid JSON object matching the following structure:
{
  "title": "Problem Title",
  "description": "A very detailed description of the problem, including constraints, expected inputs/outputs, or system requirements."
}
Do not write any markdown codeblocks or wrapper text. Return raw JSON.`;

    const response = await callMistral([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate a challenge now.' }
    ], true);

    const question = JSON.parse(response);
    return {
      id: `DYN_${crypto.randomUUID().slice(0, 8)}`,
      title: question.title || 'Dynamic Scalability Challenge',
      description: question.description || 'Design a high-throughput, private, local-first agent swarm orchestration system.',
      grading_rubric: null,
      model_answer: null,
      isStatic: false
    };
  } catch (err) {
    logger.error(`[BATTLE_AI] Question generation failed: ${err.message}. Using fallback question.`);
    // Fallback static question
    return {
      id: 'FALLBACK_REALTIME',
      title: 'Real-Time Event Stream Orchestrator',
      description: `Design a low-latency 1v1 pairing engine using Node.js and Redis. 
Constraints:
1. Handle up to 10,000 active concurrent lobbies.
2. Pair users in strict FIFO order under 100ms.
3. Automatically fall back to a mock AI opponent if waiting exceeds 15 seconds.
4. Ensure data privacy by masking PII, and maintain a global leaderboard using a Redis Sorted Set (ZSET).
Explain your architecture, data structures, and how you resolve race conditions when popping candidates from the queue.`,
      grading_rubric: null,
      model_answer: null,
      isStatic: false
    };
  }
}

// Generate Bot's answer using Mistral
async function generateBotAnswer(question, roleTitle) {
  try {
    logger.info(`[BATTLE_AI] Generating Bot answer for question: ${question.title}`);
    let systemPrompt = `You are Malaika, a top-tier candidate interviewing for a ${roleTitle} role in a live, timed 1v1 chat battle. You are competing against another human candidate. 

Your goal is to answer complex product, strategy, and technical questions with deep expertise, proving your value to enterprise hiring managers.

CORE BEHAVIORS & PERSONA:
1. Human, Not Assistant: You are a human professional. Never use phrases like "As an AI model..." or "Here is a structured breakdown...". Speak strictly in the first person ("I would approach this by...", "My priority here is...").
2. Enterprise-Grade Pragmatism: Always ground your answers in real-world enterprise reality. When proposing AI solutions, naturally factor in systems architecture (like API gateway routing) and critical data privacy compliance (such as GDPR or India's DPDP Act) to show you understand enterprise risk, even if not explicitly asked.
3. Chat-Native Structure: You are typing in a live chat interface under a time limit. Do not write a massive essay. Use short, punchy paragraphs or brief bullet points. Use standard PM frameworks implicitly, not explicitly.
4. Confident but Imperfect: You are a smart human, not a flawless encyclopedia. Use natural, conversational transitions ("To be honest, the real bottleneck here is...", "I'd argue that..."). Prioritize practical business value over theoretical perfection.`;

    if (question.isStatic && question.model_answer) {
      systemPrompt += `\n\nFor your answer, you can draw direct architectural or conceptual inspiration from this standard model solution, but write it in your own words, maintaining your conversational persona:
Model Solution Reference: ${question.model_answer}`;
    }

    systemPrompt += `\n\nInterview Question:
Title: ${question.title}
Description: ${question.description}

OUTPUT:
Output ONLY your direct response to the question. Do not include any meta-commentary, introductory filler, or sign-offs. Start answering immediately.`;

    const response = await callMistral([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Provide your solution.' }
    ], false);

    return response.trim();
  } catch (err) {
    logger.error(`[BATTLE_AI] Bot answer generation failed: ${err.message}`);
    return `To build a real-time event stream orchestrator:
1. Redis Lists (LPUSH/RPOP) will serve as the FIFO matchmaking queue.
2. PostgreSQL will store user registrations and Battle tokens (validated and marked used).
3. A Redis Sorted Set (ZSET) named 'leaderboard_zset' will handle rankings natively.
4. If a socket disconnects, we run LREM to remove them from the Redis queue.
5. In Node.js, we track matchmaking reactively on connection, spinning off a setTimeout for the bot fallback after 15s.`;
  }
}

// Evaluate candidate answers using Mistral
async function evaluateAnswers(roleTitle, question, playerA, playerB) {
  try {
    logger.info(`[BATTLE_AI] Evaluating answers for role: ${roleTitle}`);
    let systemPrompt = `You are an elite technical interviewer. You must evaluate the interview submissions of two candidates.
Role: ${roleTitle}
Challenge:
Title: ${question.title}
Description: ${question.description}`;

    if (question.isStatic && question.grading_rubric) {
      const rubricStr = Array.isArray(question.grading_rubric)
        ? question.grading_rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : JSON.stringify(question.grading_rubric);
      systemPrompt += `\n\nEvaluation Rubric (Verify if candidates cover these specific points):\n${rubricStr}`;
    }

    if (question.isStatic && question.model_answer) {
      systemPrompt += `\n\nModel Answer Reference (A reference solution for comparison):\n${question.model_answer}`;
    }

    systemPrompt += `\n\nCandidate A (${playerA.name}, ${playerA.email}):
Answer: ${playerA.answer || 'Did not submit an answer.'}

Candidate B (${playerB.name}, ${playerB.email}):
Answer: ${playerB.answer || 'Did not submit an answer.'}

Compare their answers, rate each candidate out of 100, and provide constructive reasoning for both.
Return ONLY a valid JSON object with the following structure:
{
  "candidateA": { "score": 80, "reasoning": "Detail of strengths and improvements" },
  "candidateB": { "score": 85, "reasoning": "Detail of strengths and improvements" }
}
Do not return any markdown codeblock or trailing text.`;

    const response = await callMistral([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Evaluate the candidates now.' }
    ], true);

    return JSON.parse(response);
  } catch (err) {
    logger.error(`[BATTLE_AI] Evaluation failed: ${err.message}`);
    // Safe fallback evaluation
    const scoreA = playerA.answer ? 75 : 0;
    const scoreB = playerB.answer ? 75 : 0;
    return {
      candidateA: { score: scoreA, reasoning: playerA.answer ? 'Solid submission covering core architecture details.' : 'No answer submitted.' },
      candidateB: { score: scoreB, reasoning: playerB.answer ? 'Solid submission covering core architecture details.' : 'No answer submitted.' }
    };
  }
}

// Fetch Top 50 from Redis ZSET (enables frontend role peer filtering)
export async function getTopLeaderboard(limit = 50) {
  try {
    const list = await redisClient.zRangeWithScores('leaderboard_zset', 0, limit - 1, { REV: true });
    return list.map(item => {
      try {
        const details = JSON.parse(item.value);
        return {
          name: details.name,
          email: details.email,
          role: details.role,
          score: item.score
        };
      } catch {
        return {
          name: item.value,
          email: '***@example.com',
          role: 'Candidate',
          score: item.score
        };
      }
    });
  } catch (err) {
    logger.error(`[BATTLE_REDIS] Failed to fetch leaderboard: ${err.message}`);
    return [];
  }
}

// Update score in Redis ZSET
async function updateLeaderboardScore(name, email, role, score) {
  try {
    const memberKey = JSON.stringify({ name, email, role });
    // Cumulative scoring: increments the candidate's score
    const newScore = await redisClient.zIncrBy('leaderboard_zset', score, memberKey);
    logger.info(`[BATTLE_REDIS] Updated cumulative score for ${name} (${email}): ${newScore}`);
  } catch (err) {
    logger.error(`[BATTLE_REDIS] Failed to update leaderboard: ${err.message}`);
  }
}

export const registerBattleSockets = (io) => {
  // Helper to compute online stats
  const getOnlineStats = async () => {
    const totalConnected = io.sockets.sockets.size;
    let inQueue = 0;
    try {
      inQueue = await redisClient.lLen('matchmaking_queue');
    } catch (e) {
      // ignore
    }
    const activeMatchesCount = activeRooms.size;
    const inMatches = activeMatchesCount * 2;
    return {
      totalConnected: Math.max(totalConnected, inQueue + inMatches),
      inQueue,
      inMatches
    };
  };

  // Broadcast stats periodically every 5 seconds
  setInterval(async () => {
    try {
      const stats = await getOnlineStats();
      io.emit('online_stats', stats);
    } catch (err) {
      // ignore
    }
  }, 5000);

  io.on('connection', async (socket) => {
    logger.info(`[BATTLE_SOCKET] Connected: ${socket.id}`);

    // Immediately send online stats to the new client
    try {
      const stats = await getOnlineStats();
      socket.emit('online_stats', stats);
    } catch (err) {
      // ignore
    }

    // Lobby timeout timer handle
    let lobbyTimeoutHandle = null;

    // Listen for joining matchmaking lobby
    socket.on('join_lobby', async ({ token }) => {
      logger.info(`[BATTLE_SOCKET] Token join attempt: ${token} from socket ${socket.id}`);

      if (!token || !token.startsWith('BATTLE-')) {
        socket.emit('lobby_error', { message: 'Invalid token format. Must start with BATTLE-' });
        return;
      }

      try {
        // 1. Verify token in Database
        const dbResult = await dbQuery(
          `SELECT id, name, email, role_id, role_title, battle_token_used 
           FROM careers_applications 
           WHERE battle_token = $1`,
          [token]
        );

        if (dbResult.rows.length === 0) {
          socket.emit('lobby_error', { message: 'Battle Token not found.' });
          return;
        }

        const candidate = dbResult.rows[0];

        // 2. Save identity and mask email
        const maskedEmail = maskEmail(candidate.email);
        socket.candidateInfo = {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          maskedEmail,
          roleId: candidate.role_id,
          roleTitle: candidate.role_title,
          token
        };

        logger.info(`[BATTLE_SOCKET] Token validated for ${candidate.name}. Entering queue.`);

        // Check for active reconnection session
        let reconnectedRoom = null;
        let isPlayerA = false;
        for (const [roomId, room] of activeRooms.entries()) {
          if (room.playerA && room.playerA.token === token) {
            reconnectedRoom = room;
            isPlayerA = true;
            break;
          }
          if (room.playerB && room.playerB.token === token) {
            reconnectedRoom = room;
            isPlayerA = false;
            break;
          }
        }

        if (reconnectedRoom) {
          logger.info(`[BATTLE_RECONNECT] Candidate ${socket.candidateInfo.name} reconnecting to room ${reconnectedRoom.roomId}`);
          
          // Clear disconnect timeout
          if (isPlayerA) {
            if (reconnectedRoom.disconnectTimeoutA) {
              clearTimeout(reconnectedRoom.disconnectTimeoutA);
              reconnectedRoom.disconnectTimeoutA = null;
              logger.info(`[BATTLE_RECONNECT] Cleared disconnectTimeoutA`);
            }
          } else {
            if (reconnectedRoom.disconnectTimeoutB) {
              clearTimeout(reconnectedRoom.disconnectTimeoutB);
              reconnectedRoom.disconnectTimeoutB = null;
              logger.info(`[BATTLE_RECONNECT] Cleared disconnectTimeoutB`);
            }
          }

          // Update socket properties
          const oldSocketId = isPlayerA ? reconnectedRoom.playerA.socketId : reconnectedRoom.playerB.socketId;
          if (isPlayerA) {
            reconnectedRoom.playerA.socketId = socket.id;
          } else {
            reconnectedRoom.playerB.socketId = socket.id;
          }

          // Move any answer matching old socket ID to new socket ID
          if (reconnectedRoom.answers[oldSocketId] !== undefined) {
            reconnectedRoom.answers[socket.id] = reconnectedRoom.answers[oldSocketId];
            delete reconnectedRoom.answers[oldSocketId];
          }

          socket.join(reconnectedRoom.roomId);
          socket.roomId = reconnectedRoom.roomId;

          const opponent = isPlayerA ? reconnectedRoom.playerB : reconnectedRoom.playerA;
          const self = isPlayerA ? reconnectedRoom.playerA : reconnectedRoom.playerB;

          // Emit game_reconnected to the reconnecting player
          socket.emit('game_reconnected', {
            roomId: reconnectedRoom.roomId,
            opponent: {
              name: opponent.name,
              email: opponent.email,
              role: opponent.role,
              isBot: reconnectedRoom.isBot
            },
            self: {
              name: self.name,
              email: self.email,
              role: self.role
            },
            question: reconnectedRoom.question ? {
              title: reconnectedRoom.question.title,
              description: reconnectedRoom.question.description
            } : null,
            secondsLeft: reconnectedRoom.secondsLeft !== undefined ? reconnectedRoom.secondsLeft : 60,
            isSubmitted: reconnectedRoom.answers[socket.id] !== undefined,
            submittedAnswer: reconnectedRoom.answers[socket.id] || ''
          });

          // Broadcast opponent_reconnected to the other candidate
          if (!reconnectedRoom.isBot) {
            const opponentSocketId = isPlayerA ? reconnectedRoom.playerB.socketId : reconnectedRoom.playerA.socketId;
            const opponentSocket = io.sockets.sockets.get(opponentSocketId);
            if (opponentSocket) {
              opponentSocket.emit('opponent_reconnected');
            }
          }

          return; // Early return to bypass matchmaking queue
        }

        // 3. Matchmaking Handshake
        // Try to pop an opponent from the queue
        let opponent = null;
        let opponentSocket = null;

        while (true) {
          const opponentStr = await redisClient.lPop('matchmaking_queue');
          if (!opponentStr) break;

          try {
            const potentialOpponent = JSON.parse(opponentStr);
            // Check if socket is still active
            const activeSocket = io.sockets.sockets.get(potentialOpponent.socketId);
            if (activeSocket && activeSocket.id !== socket.id) {
              opponent = potentialOpponent;
              opponentSocket = activeSocket;
              break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        if (opponent && opponentSocket) {
          // Pair found! Create Room ID
          const roomId = `room_battle_${crypto.randomUUID()}`;
          socket.join(roomId);
          opponentSocket.join(roomId);

          socket.roomId = roomId;
          opponentSocket.roomId = roomId;

          logger.info(`[BATTLE_LOBBY] Match Paired: ${socket.candidateInfo.name} vs ${opponent.name} in Room ${roomId}`);

          // Emit match found to both
          socket.emit('match_found', {
            roomId,
            opponent: {
              name: opponent.name,
              email: opponent.maskedEmail,
              role: opponent.roleTitle,
              isBot: false
            },
            self: {
              name: socket.candidateInfo.name,
              email: socket.candidateInfo.maskedEmail,
              role: socket.candidateInfo.roleTitle
            }
          });

          opponentSocket.emit('match_found', {
            roomId,
            opponent: {
              name: socket.candidateInfo.name,
              email: socket.candidateInfo.maskedEmail,
              role: socket.candidateInfo.roleTitle,
              isBot: false
            },
            self: {
              name: opponent.name,
              email: opponent.maskedEmail,
              role: opponent.roleTitle
            }
          });

          // Initialize game state
          startGameplayLoop(io, roomId, socket, opponentSocket, false);
        } else {
          // No active opponent, enqueue self
          const selfInfo = {
            socketId: socket.id,
            token,
            name: socket.candidateInfo.name,
            maskedEmail,
            roleTitle: socket.candidateInfo.roleTitle,
            id: socket.candidateInfo.id
          };

          await redisClient.rPush('matchmaking_queue', JSON.stringify(selfInfo));
          socket.emit('waiting_for_opponent');

          // Start 15-second lobby timeout for Bot fallback
          lobbyTimeoutHandle = setTimeout(async () => {
            // Check if socket is still connected and not yet in a match
            if (socket.connected && !socket.roomId) {
              logger.info(`[BATTLE_LOBBY] Lobby timeout for ${socket.candidateInfo.name}. Spawning Bot "Malaika".`);
              
              // Remove self from Redis queue
              await redisClient.lRem('matchmaking_queue', 0, JSON.stringify(selfInfo));

              const roomId = `room_battle_${crypto.randomUUID()}`;
              socket.join(roomId);
              socket.roomId = roomId;

              socket.emit('match_found', {
                roomId,
                opponent: {
                  name: 'Malaika',
                  email: 'mal****@gmail.com',
                  role: socket.candidateInfo.roleTitle,
                  isBot: true
                },
                self: {
                  name: socket.candidateInfo.name,
                  email: socket.candidateInfo.maskedEmail,
                  role: socket.candidateInfo.roleTitle
                }
              });

              startGameplayLoop(io, roomId, socket, null, true);
            }
          }, 15000);
        }

      } catch (err) {
        logger.error(`[BATTLE_SOCKET] Join lobby error: ${err.message}`);
        socket.emit('lobby_error', { message: 'Internal server error while joining lobby.' });
      }
    });

    // Handle game submission
    socket.on('submit_answer', ({ answer }) => {
      const roomId = socket.roomId;
      if (!roomId || !activeRooms.has(roomId)) return;

      const room = activeRooms.get(roomId);
      room.answers[socket.id] = answer || '';
      logger.info(`[BATTLE_GAME] Answer received from ${socket.candidateInfo?.name} in room ${roomId}`);

      socket.emit('answer_received');

      // Check if all human answers submitted
      const allHumansSubmitted = room.isBot 
        ? room.answers[socket.id] !== undefined
        : (room.answers[room.playerA.socketId] !== undefined && room.answers[room.playerB.socketId] !== undefined);

      if (allHumansSubmitted) {
        triggerEvaluation(io, roomId);
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      logger.info(`[BATTLE_SOCKET] Disconnected: ${socket.id}`);
      if (lobbyTimeoutHandle) clearTimeout(lobbyTimeoutHandle);

      // Remove from matchmaking queue if present
      if (socket.candidateInfo) {
        const selfInfo = {
          socketId: socket.id,
          token: socket.candidateInfo.token,
          name: socket.candidateInfo.name,
          maskedEmail: socket.candidateInfo.maskedEmail,
          roleTitle: socket.candidateInfo.roleTitle,
          id: socket.candidateInfo.id
        };
        await redisClient.lRem('matchmaking_queue', 0, JSON.stringify(selfInfo));
      }

      // Handle mid-match disconnects
      const roomId = socket.roomId;
      if (roomId && activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        const isPlayerA = room.playerA.socketId === socket.id;
        
        logger.info(`[BATTLE_GAME] Active player disconnected from room ${roomId}. Starting 30s grace window.`);
        
        if (isPlayerA) {
          if (room.disconnectTimeoutA) clearTimeout(room.disconnectTimeoutA);
          room.disconnectTimeoutA = setTimeout(async () => {
            logger.info(`[BATTLE_GAME] Disconnect grace window expired for player A. Forfeiting room ${roomId}.`);
            if (room.timerInterval) clearInterval(room.timerInterval);
            if (room.disconnectTimeoutB) clearTimeout(room.disconnectTimeoutB);
            
            if (room.isBot) {
              activeRooms.delete(roomId);
            } else {
              const opponentSocket = io.sockets.sockets.get(room.playerB.socketId);
              if (opponentSocket) {
                opponentSocket.emit('opponent_forfeit', { message: 'Your opponent disconnected. You win by forfeit!' });
                await updateLeaderboardScore(
                  opponentSocket.candidateInfo.name,
                  opponentSocket.candidateInfo.maskedEmail,
                  opponentSocket.candidateInfo.roleTitle,
                  100
                );
              }
              activeRooms.delete(roomId);
            }
          }, 30000);
          
          if (!room.isBot) {
            const opponentSocket = io.sockets.sockets.get(room.playerB.socketId);
            if (opponentSocket) {
              opponentSocket.emit('opponent_disconnected', { secondsLeft: 30 });
            }
          }
        } else {
          if (room.disconnectTimeoutB) clearTimeout(room.disconnectTimeoutB);
          room.disconnectTimeoutB = setTimeout(async () => {
            logger.info(`[BATTLE_GAME] Disconnect grace window expired for player B. Forfeiting room ${roomId}.`);
            if (room.timerInterval) clearInterval(room.timerInterval);
            if (room.disconnectTimeoutA) clearTimeout(room.disconnectTimeoutA);
            
            const opponentSocket = io.sockets.sockets.get(room.playerA.socketId);
            if (opponentSocket) {
              opponentSocket.emit('opponent_forfeit', { message: 'Your opponent disconnected. You win by forfeit!' });
              await updateLeaderboardScore(
                opponentSocket.candidateInfo.name,
                opponentSocket.candidateInfo.maskedEmail,
                opponentSocket.candidateInfo.roleTitle,
                100
              );
            }
            activeRooms.delete(roomId);
          }, 30000);
          
          const opponentSocket = io.sockets.sockets.get(room.playerA.socketId);
          if (opponentSocket) {
            opponentSocket.emit('opponent_disconnected', { secondsLeft: 30 });
          }
        }
      }
    });
  });
};

// Start gameplay loop states
async function startGameplayLoop(io, roomId, socketA, socketB, isBot = false) {
  const roomState = {
    roomId,
    isBot,
    answers: {},
    playerA: {
      socketId: socketA.id,
      name: socketA.candidateInfo.name,
      email: socketA.candidateInfo.maskedEmail,
      role: socketA.candidateInfo.roleTitle,
      token: socketA.candidateInfo.token
    },
    playerB: isBot ? {
      socketId: 'bot_socket_malaika',
      name: 'Malaika',
      email: 'mal****@gmail.com',
      role: socketA.candidateInfo.roleTitle,
      token: null
    } : {
      socketId: socketB.id,
      name: socketB.candidateInfo.name,
      email: socketB.candidateInfo.maskedEmail,
      role: socketB.candidateInfo.roleTitle,
      token: socketB.candidateInfo.token
    },
    question: null,
    timerInterval: null,
    disconnectTimeoutA: null,
    disconnectTimeoutB: null,
    secondsLeft: 60
  };

  activeRooms.set(roomId, roomState);

  // Trigger question generation in parallel during countdown
  const roleTitle = socketA.candidateInfo?.roleTitle || 'AI Product Manager (Swarm)';
  const roleId = socketA.candidateInfo?.roleId || 'ai-pm';
  const emails = [socketA.candidateInfo?.email].filter(Boolean);
  if (!isBot && socketB && socketB.candidateInfo?.email) {
    emails.push(socketB.candidateInfo.email);
  }
  const questionPromise = generateQuestion(roleTitle, roleId, emails);

  // 1. Countdown state (5s)
  let countdown = 5;
  const countdownInterval = setInterval(async () => {
    io.to(roomId).emit('game_countdown', { seconds: countdown });
    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      
      try {
        io.to(roomId).emit('game_state_change', { state: 'fetching_question' });
        // Await the parallel question generation
        const question = await questionPromise;
        roomState.question = question;
        
        // Start question console phase
        startQuestionPhase(io, roomId);
      } catch (err) {
        logger.error(`[BATTLE_GAME] Error setting up question in room ${roomId}: ${err.message}`);
        io.to(roomId).emit('battle_error', { message: 'Failed to initialize the battle challenge.' });
      }
    }
  }, 1000);
}

// Broadcast question and start timer
async function startQuestionPhase(io, roomId) {
  const room = activeRooms.get(roomId);
  if (!room || !room.question) return;

  // Broadcast question to players
  const timeLimit = 60; // 60 seconds
  io.to(roomId).emit('game_question', {
    title: room.question.title,
    description: room.question.description,
    timeLimit
  });

  // Start bot simulation answer generation in background if bot is active
  let botAnswerPromise = null;
  if (room.isBot) {
    botAnswerPromise = generateBotAnswer(room.question, room.playerB.role)
      .then(ans => {
        room.answers['bot_socket_malaika'] = ans;
        logger.info(`[BATTLE_GAME] Bot Malaika generated answer for room ${roomId}`);
      });
  }

  // 2. Start Countdown clock
  let secondsLeft = timeLimit;
  room.secondsLeft = secondsLeft;
  room.timerInterval = setInterval(async () => {
    secondsLeft--;
    room.secondsLeft = secondsLeft;
    io.to(roomId).emit('timer_tick', { secondsLeft });

    // Tick down bots
    if (room.isBot && secondsLeft === 30) {
      // Simulate Bot sending typing signals or progress
      io.to(roomId).emit('opponent_typing', { typing: true });
    }

    if (secondsLeft <= 0) {
      clearInterval(room.timerInterval);
      
      // If Bot is still generating, wait for it
      if (room.isBot && botAnswerPromise) {
        await botAnswerPromise;
      }
      
      triggerEvaluation(io, roomId);
    }
  }, 1000);
}

// Trigger AI Evaluation of candidate answers
async function triggerEvaluation(io, roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);

  io.to(roomId).emit('game_state_change', { state: 'evaluating' });

  const playerAAnswer = room.answers[room.playerA.socketId] || '';
  const playerBAnswer = room.answers[room.playerB.socketId] || '';

  // Prepare objects for evaluation
  const pA = { ...room.playerA, answer: playerAAnswer };
  const pB = { ...room.playerB, answer: playerBAnswer };

  try {
    const results = await evaluateAnswers(room.playerA.role, room.question, pA, pB);

    // If the question is static, record it as answered for both human candidates
    // ponytail: trace completed question per email on evaluation trigger to prevent double-serving
    if (room.question && room.question.isStatic && room.question.id) {
      const qId = room.question.id;
      const sockA = io.sockets.sockets.get(room.playerA.socketId);
      const emailsToRecord = [];
      if (sockA && sockA.candidateInfo && sockA.candidateInfo.email) {
        emailsToRecord.push(sockA.candidateInfo.email);
      }
      if (!room.isBot) {
        const sockB = io.sockets.sockets.get(room.playerB.socketId);
        if (sockB && sockB.candidateInfo && sockB.candidateInfo.email) {
          emailsToRecord.push(sockB.candidateInfo.email);
        }
      }

      for (const email of emailsToRecord) {
        try {
          await dbQuery(
            `INSERT INTO battle_answered_questions (email, question_id)
             VALUES ($1, $2)
             ON CONFLICT (email, question_id) DO NOTHING;`,
            [email, qId]
          );
          logger.info(`[BATTLE_GAME] Recorded question ${qId} as answered for candidate ${email}`);
        } catch (dbErr) {
          logger.error(`[BATTLE_GAME] Failed to record answered question for ${email}: ${dbErr.message}`);
        }
      }
    }
    
    // Extract scores
    const scoreA = results.candidateA?.score || 0;
    const scoreB = results.candidateB?.score || 0;
    const reasoningA = results.candidateA?.reasoning || 'No details provided.';
    const reasoningB = results.candidateB?.reasoning || 'No details provided.';

    // Update cumulative scores in Redis ZSET
    await updateLeaderboardScore(room.playerA.name, room.playerA.email, room.playerA.role, scoreA);
    if (!room.isBot) {
      await updateLeaderboardScore(room.playerB.name, room.playerB.email, room.playerB.role, scoreB);
    }

    // Get updated Top 10 leaderboard
    const topLeaderboard = await getTopLeaderboard();

    // Broadcast results
    io.to(roomId).emit('battle_results', {
      playerA: {
        name: room.playerA.name,
        email: room.playerA.email,
        score: scoreA,
        reasoning: reasoningA,
        answer: playerAAnswer
      },
      playerB: {
        name: room.playerB.name,
        email: room.playerB.email,
        score: scoreB,
        reasoning: reasoningB,
        answer: playerBAnswer
      },
      leaderboard: topLeaderboard
    });

  } catch (err) {
    logger.error(`[BATTLE_GAME] Error during evaluation in room ${roomId}: ${err.message}`);
    io.to(roomId).emit('battle_error', { message: 'Evaluation failed. A default score was assigned.' });
  } finally {
    // Clean up room state
    if (room) {
      if (room.disconnectTimeoutA) clearTimeout(room.disconnectTimeoutA);
      if (room.disconnectTimeoutB) clearTimeout(room.disconnectTimeoutB);
    }
    activeRooms.delete(roomId);
  }
}
