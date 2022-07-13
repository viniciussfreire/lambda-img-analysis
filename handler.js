'use strict';
const aws = require('aws-sdk');
const { get } = require('axios');

class Handler {
  constructor({
    rekoSvc,
    translatorSvc
  }) {
    this.rekoSvc = rekoSvc;
    this.translatorSvc = translatorSvc;
  };

  async main(event) {
    try {
      const { imgUrl } = event.queryStringParameters;

      console.log('Downloading image...')
      const imgBuffer = await this.getImgBuffer(imgUrl);

      console.log('Detecting labels...');
      const { names, workingItems } = await this.detectImgLabels(imgBuffer)

      console.log('Translating to Portuguese...');
      const texts = await this.translateText(names);

      console.log('Handling final object...');
      const finalText = this.formatTextResults(texts, workingItems);

      return {
        statusCode: 200,
        message: `A imagem tem \n`.concat(finalText)
      };
    } catch (err) {
      console.error('Error => ', err.stack);
      return {
        statusCode: 500,
        message: 'Internal Server Error'
      };
    };
  };

  async detectImgLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise();

    const workingItems = result.Labels
      .filter(({ Confidence }) => Confidence > 80.0);

    const names = workingItems
      .map(({ Name }) => Name)
      .join(' and ');

    return { names, workingItems };
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text,
    }

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise();

    return TranslatedText.split(' e ');
  }

  formatTextResults(texts, workingItems) {
    const finalText = [];
    for (const indexText in texts) {
      const nameInPt = texts[indexText];
      const confidence = workingItems[indexText].Confidence;

      finalText.push(`${confidence.toFixed(2)}% de ser do tipo ${nameInPt}`)
    };

    return finalText.join('\n');
  }

  async getImgBuffer(imgUrl) {
    const response = await get(imgUrl, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data, 'base64');
    return buffer;
  }
};

// Factories
const reko = new aws.Rekognition();
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator
});

module.exports.main = handler.main.bind(handler);
