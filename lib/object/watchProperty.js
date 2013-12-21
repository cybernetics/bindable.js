/**
 * bindable.bind("a", fn);
 */

function watchSimple (bindable, property, fn) {
  var listener = bindable.on("change:" + property, fn);

  return {
    now: function () {
      fn(bindable.get(property));
    },
    dispose: function () {
      listener.dispose();
    }
  }
}

/**
 * bindable.bind("a.b.c.d.e", fn);
 */

function watchChain (bindable, chain, fn) {

  var listeners = [], values, self;

  function onChange () {
    dispose();
    listeners = [];
    values = undefined;
    bind(bindable, chain);
    fn(values);
  }

  function bind (target, chain) {

    var subChain, subValue, j, computed;

    for (var i = 0, n = chain.length; i < n; i++) {

      subChain        = chain.slice(0, i + 1);
      subValue        = target.get(subChain);

      // pass the watch onto the bindable object, but also listen 
      // on the current target for any
      if (subValue && subValue.__isBindable) {
        bind(subValue, chain.slice(i + 1));
      }

      listeners.push(target.on("change:" + subChain.join("."), onChange));
    }

    values = subValue;
  }

  function dispose () {
    if (!listeners) return;
    for (var i = listeners.length; i--;) {
      listeners[i].dispose();
    }
    listeners = undefined;
  }

  bind(bindable, chain);

  return self = {
    now: function () {
      fn(values);
    },
    dispose: dispose
  }
}

function watchComputed (bindable, chain, fn) {

  var listeners = [], values, self;

  function onChange () {
    dispose();
    listeners = [];
    values = undefined;
    bind(bindable, chain);
    self.now();
  }

  function bind (target, chain) {

    var subChain, subValue, currentProperty, j, computed;

    for (var i = 0, n = chain.length; i < n; i++) {

      subChain        = chain.slice(0, i + 1);
      currentProperty = chain[i];

      // check for @ at the beginning
      if (currentProperty.charCodeAt(0) === 64) {

        // remove @
        subChain[i] = subChain[i].substr(1);
        computed = true;
      }

      // fetch the property
      subValue        = target.get(subChain);

      if (computed && subValue) {
        var context = target.get(subChain.slice(0, subChain.length - 1));

        if (subValue.compute) {
          for (var i = subValue.compute.length; i--;) {
            bind(target, subValue.compute[i]);
          }
        }

        var eachChain = chain.slice(i + 1);

        // call the function, looping through items
        subValue.call(context, function (item) {

          if (!eachChain.length) {
            if (!values) values = [];
            values.push(item);
          }

          // must be a bindable object to continue
          if (item && item.__isBindable) {
            bind(item, eachChain);
          }
        });
      }

      listeners.push(target.on("change:" + subChain.join("."), onChange));
    } 
  }

  function dispose () {
    if (!listeners) return;
    for (var i = listeners.length; i--;) {
      listeners[i].dispose();
    }
    listeners = undefined;
  }

  bind(bindable, chain);

  return self = {
    now: function () {
      fn(values);
    },
    dispose: dispose
  }
}

/**
 */

function watchProperty (bindable, property, fn) {

  // person.bind("firstName, lastName")
  if (~property.indexOf(",")) return watchMultiple(bindable, property.split(/[,\s*]+/).forEach(function (prop) {
    return prop.split(".");
  }), fn);

  var chain        = property.split(".");

  // collection.bind("length")
  if (chain.length === 1) return watchSimple(bindable, property, fn);

  // person.bind("city.zip")
  if (~property.indexOf("@")) {
    return watchComputed(bindable, chain, fn);
  } else {
    return watchChain(bindable, chain, fn);
  }
  
}

module.exports = watchProperty;