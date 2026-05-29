import { createVercelAiHandler } from '../../src/server/aiApiAdapter';

export default createVercelAiHandler('analyze-researcher');

export const config = {
  maxDuration: 60,
};
