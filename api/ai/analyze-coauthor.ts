import { createVercelAiHandler } from '../../src/server/aiApiAdapter';

export default createVercelAiHandler('analyze-coauthor');

export const config = {
  maxDuration: 60,
};
