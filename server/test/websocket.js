'use strict'

var xmpp = require('../index')
  , assert = require('assert')
  , Client = require('../lib/xmpp').client
  , Message = require('../lib/xmpp').core.Stanza.Message

var eventChain = []
var websocket = null

function startServer(done) {

    // Sets up the server.
    websocket = new xmpp.WebSocketServer({
        port: 5280,
        domain: 'localhost'
    })

    websocket.on('error', function(err) {
        console.log('websocket error: ' + err.message)
    })

    websocket.on('connect', function(client) {
        client.on('register', function(opts, cb) {
            cb(new Error('register not supported'))
        })

        // allow anything
        client.on('authenticate', function(opts, cb) {
            eventChain.push('authenticate')
            cb(null, opts)
        })

        client.on('online', function() {
            eventChain.push('online')
        })

        client.on('stanza', function() {
            eventChain.push('stanza')
            client.send(
                new Message({ type: 'chat' })
                    .c('body')
                .t('Hello there, little client.')
            )
        })

        client.on('disconnect', function() {
            eventChain.push('disconnect')
        })

        client.on('end', function() {
            eventChain.push('end')
        })

        client.on('close', function() {
            eventChain.push('close')
        })

        client.on('error', function() {
            eventChain.push('error')
        })
    })
    done()
}

describe('WebSocketServer', function() {

    var cl = null

    before(function(done) {
        startServer(done)
    })

    after(function(done) {
        websocket.shutdown(done)
    })

    describe('events', function() {
        it('should be in the right order for connecting', function(done) {
            eventChain = []

            cl = new Client({
                websocket: { url: 'ws://localhost:5280' },
                jid: 'bob@example.com',
                password: 'alice',
                host: 'localhost'
            })
            cl.on('online', function() {
                eventChain.push('clientonline')
                assert.deepEqual(eventChain, ['authenticate', 'online', 'clientonline'])
                done()
            })
            cl.on('error', function(e) {
                done(e)
            })

        })

        it('should ping pong stanza', function(done) {
            eventChain = []

            cl.on('stanza', function() {
                eventChain.push('clientstanza')
                assert.deepEqual(eventChain, ['stanza', 'clientstanza'])
                done()
            })

            cl.send(
                new Message({ type: 'chat' })
                    .c('body')
                    .t('Hello there, little server.')
            )

            cl.on('error', function(e) {
                done(e)
            })
        })

        it('should close the connection', function(done) {
            eventChain = []

            // end xmpp stream
            cl.on('end', function() {
                eventChain.push('clientend')
            })

            // close socket
            cl.on('close', function() {
                eventChain.push('clientclose')
                assert.deepEqual(eventChain, [
                    'clientend',
                    'end',
                    'disconnect',
                    'disconnect',
                    'clientclose'
                ])
                done()
            })

            cl.end()
        })
    })
})
