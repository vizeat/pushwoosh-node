'use strict'
const Promise = require('bluebird')
const rp = require('request-promise')
const _ = require('lodash')

const defaults = {
  host: 'cp.pushwoosh.com',
  url: 'https://cp.pushwoosh.com/json',
  version: '1.3'
}

class PushwooshClient {
  /**
   * PushwooshClient constructor
   * @param  {String} app      AppId provided by Pushwoosh
   * @param  {String} token    API token provided by Pushwoosh
   * @param  {Object} options  configuration options for the client
   * @return {PushwooshClient} usable API client
   */
  constructor (app, token, options) {
    options = options || {}
    if (!_.isString(app) || !_.isString(token)) {
      throw new Error('Pushwoosh Application ID and an Authentication Token must be set')
    }

    this.app = app
    this.token = token
    this.host = options.host || defaults.host
    this.version = options.version || defaults.version
    this.useAppGroup = options.useAppGroup
    this.timeout = options.timeout || 31000
  }

  /**
   * Promise/Callback Helper method
   * @param  {Function} resolve the resolve method from the parent promise
   * @param  {Function} cb      the optional callback passed to the parent function
   * @param  {Array}   ...args  the remaining arguments to be passed to callbacks/resolve function
   * @return {Promise}          the resolved promise with the arguments
   */
  // handleSuccess (resolve, cb, ...args) {
  handleSuccess (resolve, cb) {
    let args = _.takeRight(_.toArray(arguments), 2)
    if (_.isFunction(cb)) {
      cb.apply(this, args.unshift(null))
    }
    return resolve.apply(this, args)
  }

  /**
   * Promise/Callback Helper method
   * @param  {Function} reject the reject method from the parent promise
   * @param  {Function} cb      the optional callback passed to the parent function
   * @param  {Array}   ...args  the remaining arguments to be passed to callbacks/resolve function
   * @return {Promise}          the rejected promise with the reason
   */
  // handleRejection (reject, cb, ...args) {
  handleRejection (reject, cb) {
    let args = _.takeRight(_.toArray(arguments), 2)
    if (_.isFunction(cb)) {
      cb.apply(this, args)
    }
    return reject.apply(this, args)
  }

  /**
   * Send a request to PushWoosh API
   * @param  {String}   action the endpoint to call on the API
   * @param  {Object}   data   the data to send to the API
   * @param  {Function} cb     the optional callback to handle the API response
   * @return {Promise}         a Promise for the API response
   */
  sendRequest (action, data, cb) {
    return new Promise((resolve, reject) => {
      return rp({
        method: 'POST',
        json: true,
        resolveWithFullResponse: true,
        uri: `https://${this.host}/json/${this.version}/${action}`,
        body: data
      }).then((response) => {
        return this.handleSuccess(resolve, cb, response)
      }).catch((error) => {
        return this.handleRejection(reject, cb, error)
      })
    })
  }

  /**
   * Parse the API Response
   * @param  {Object}   response request-promise full response object
   * @param  {Function} cb       optional callback
   * @return {Promise}           a Promise of parsed answer
   * @see    http://docs.pushwoosh.com/docs/createmessage#section-response-
   */
  parseResponse (response, cb) {
    return new Promise((resolve, reject) => {
      if (response.statusCode === 200 && response.body.status_code === 200) {
        return this.handleSuccess(resolve, cb, response.body.response)
      } else {
        return this.handleRejection(reject, cb, response.body)
      }
    })
  }

  /**
   * Send a notification
   * @param  {String}   message  Message sent (optional, if options.content is provided)
   * @param  {Object}   options  May contain:
   *                             - {String} content (optional, if message is provided)
   *                             - {Array}  devices
   *                             - {String} send_date
   *                             - {Bool}   ignore_user_timezone
   *                             - {Object} data
   *                             - {Array}  platforms
   * @param  {Function} cb       optional callback that would be called with the API response
   * @return {Promise}           A promise for the API reponse
   * @see    http://docs.pushwoosh.com/docs/createmessage#parameters
   */
  sendMessage (message, options, cb) {
    if (_.isObject(message) && _(message).has('content')) {
      if (_.isFunction(options)) {
        cb = options
      }
      options = message
      message = options.content
    }

    let defaults = {
      send_date: 'now',
      ignore_user_timezone: true,
      content: message
    }

    return new Promise((resolve, reject) => {
      if (!_.isString(message)) {
        return this.handleRejection(reject, cb, new Error('options.message should be provided as a string'))
      }

      let body = {
        request: {
          auth: this.token,
          notifications: [_.extend({}, defaults, options, {content: message})]
        }
      }

      if (this.useAppGroup) {
        body.request.application_group = this.app
      } else {
        body.request.application = this.app
      }

      return this.sendRequest('createMessage', body)
        .then((response) => {
          return this.handleSuccess(resolve, cb, response)
        })
        .catch((error) => {
          return this.handleRejection(reject, cb, error)
        })
    })
  }

  /**
   * [description]
   * @param  {Object}   options [description]
   * @param  {Function} cb      optional callback
   * @return {Promise}          [description]
   */
  registerDevice (options, cb) {
    return new Promise((resolve, reject) => {
      if (!_.isString(options.push_token)) {
        return this.handleRejection(reject, cb, new Error('Device push token is mandatory (string)'))
      }

      if (_.isString(options.hwid)) {
        return this.handleRejection(reject, cb, new Error('Device hwid token is mandatory (string)'))
      }

      if (_.isNumber(options.device_type)) {
        return this.handleRejection(reject, cb, new Error('Device type is mandatory (number)'))
      }
      let body = {
        request: _.extend({}, {application: this.app}, options)
      }

      return this.sendRequest('registerDevice', body)
        .then((response) => {
          return this.handleSuccess(resolve, cb, response)
        })
        .catch((error) => {
          return this.handleRejection(reject, cb, error)
        })
    })
  }

  /**
   * [description]
   * @param  {String}   code [description]
   * @param  {Function} cb   optional callback
   * @return {Promise}       [description]
   */
  deleteMessage (code, cb) {
    return new Promise((resolve, reject) => {
      if (!_.isString(code)) {
        return this.handleRejection(reject, cb, new Error('Message id is mandatory (string)'))
      }
      let body = {
        request: {
          auth: this.token,
          message: code
        }
      }
      return this.sendRequest('deleteMessage', body)
        .then((response) => {
          return this.handleSuccess(resolve, cb, response)
        })
        .catch((error) => {
          return this.handleRejection(reject, cb, error)
        })
    })
  }
}

module.exports = PushwooshClient
