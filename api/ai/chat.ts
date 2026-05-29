import { createVercelAiHandler } from '../../src/server/aiApiAdapter';

export default createVercelAiHandler('chat');

export const config = {
  maxDuration: 60,
};
