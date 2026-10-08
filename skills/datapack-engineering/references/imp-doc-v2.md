# IMP-Doc v2

> **Source Specification**: [IMP-Doc v2 Official Google Doc](https://docs.google.com/document/d/1ayElBb9jN_1NAUgPhfwu5uOR2uhn8bKYq2HTURIwGbI)
> **Status**: Official Reference Specification

## Interoperable Module Protocol - Documentation Format, v2

IMP-Doc is used for documenting many parts of data/resource packs, with both human readable descriptions and machine readable directives for validation and improved display of the documentation.

**TODO: document the various doc resource specifiers, add lots of examples, indicate differences from imp-doc v1 and from the extensions to v1 that were supported in Spyglass v3**

# Documentation Block

Each resource in a data/resource pack can have documentation associated with it by making a documentation block, either in inline comments or in separate .impdoc files.

A documentation block is started with a > character followed by a specifier of what is being documented, and ends at the start of the next documentation block or at the end of the comment block containing the documentation block.  
The exact format of the specifier varies depending on what is being documented, and where the documentation block is located.

## Function comment doc blocks

In mcfunction files a documentation block can be included in mcfunction # comments. Any sequence of comments, with no empty lines or comments in between, count as a single block comment.  
For example, this contains three comment blocks, separated by an empty line and a command:  
# this is the first  
# block comment

# this is the  
# second block  
# comment  
say separator  
# this is the  
# third  
# block  
# comment

A comment block can either be regular text (a normal comment), or can be a documentation block by starting with a > character.

### Function headers

Most documentation blocks inside a function require a full documentation resource specifier, however if the documentation block is the very first thing in the file (ignoring empty lines and regular comments), the specifier defaults to documenting the function itself.

Namely, in the function header this doc resource specifier:  
#> namespace:this_function  
Is equivalent to this doc resource specifier:  
#> function namespace:this_function

## Scoreboard objective/holder doc blocks

Scoreboard objectives and individual scoreboard holder+objective pairs can be documented with objective and score doc resource specifiers respectively.   
The range/type of the value can be specified using the @type directive, however since scores are always an int the underlying type must be an int. e.g. int @ -10..10, enum(int) {...}. If the type isn't specified it defaults to int.

### Objectives

> objective <name>

The objective doc block is used to document an objective, regardless of which scoreholder actually has the objective.  
**TODO: Should there be a way to specify what kinds of scoreholders can have this objective?**

### Scoreholders

> score <name> <objective>

The score doc block is used to document a scoreboard value for a specific holder and specific objective.  
If a type is specified for a score doc block, it must be a subset of the type for the associated objective.

### Examples

#> objective namespace.foo   
#  Holds the value for foo calculations  
#  @type int @ -10..10  
#> score bar namespace.foo  
#  Bar has a smaller range  
#  @type int @ -5..5  
scoreboard objectives add namespace.foo dummy

#> objective external.baz  
#  Baz stuff

#> score funny declared.somewhere_else  
#  Funny has only two values, acting like a boolean  
#  @type int @ 0..1

#> objective color_space  
#  The colour space to work within  
#  @type enum(int) {  
#    /// Gamma corrected RGB  
#    SRGB = 0,  
#      
#    /// Linear RGB  
#    RGB = 1,  
#  
#    /// Perceptual oklab colour  
#    OKLAB = 2,  
#  }

# Standalone .impdoc files

.impdoc files can be used as dedicated documentation files. They contain any number of documentation blocks, and the resource specifier is required (it cannot be implied by location). These standalone files are useful for documenting files that don't have a comment format (e.g. .json files), or for developers to collect documentation into a single place if desired.

# Common Directives

These directives are common for all documentation blocks, regardless of the documentation resource specifier.

## Usage directives

Usage directives indicate how the resource being documented is intended to be used/referenced/called etc.

Note that parents of the resource, e.g. folders, can also specify usage directives. In this situation, the usage modifiers on the resource itself are considered "nested" inside the parent usage modifier.  
e.g. If folder "a" is marked as @private within folder "b", a resource within folder "a" that is marked as @public will be visible to anything within folder "b" but not outside folder "b"

### @public

Specifies that this resource can be used anywhere, including other data/resource packs. Things documented with this directive should be very well documented and resilient to unexpected inputs.

### @internal

Specifies that this resource can be expected to appear anywhere within this data/resource pack.

### @user

Specifies that this resource is intended to be used directly by players (typically server operators).

If specified without any other usage directives, indicates that this is meant to **only** be used by players directly, and should not be referenced anywhere else.  
This is typically for things like operator tellraw menus that expect to be able to interact with the player back-and-forth

If specified along with @public, this resource can also be referenced elsewhere.  
This is typically for things that support user interaction, but that also produce results that can be accessed automatically.

### @private

Specifies that this resource can only be referenced from within certain specified places.

@private by itself is a shorthand for @private within parent

When specifying only a single file, the directive can be written on a single line, but if there are multiple the individual places must be listed on separate lines, with at least one indentation whitespace (spaces/horizontal tabs)

Syntax:  
@private within  
  (this|parent|<doc resource specifier>)+

* this refers to the resource being documented  
* parent refers to whatever the doc block is being defined inside of, e.g. in a function file a doc block (other than the header) will reference the function itself, and doc blocks in the header of functions and in .impdoc files will reference the folder holding the file  
* Doc resource specifiers also support globs. EG: `@private within namespace:player/*`

### @override

This directive specifies that this is intentionally overriding an existing version of the same resource.  
This is used for resources that do not automatically merge (e.g. functions), or that are overriding the typical merge behaviour (e.g. tags), to indicate that it is modifying existing behaviour.

### @deprecated

This directive specifies that the resource in question is not recommended for use in any newly written code, no matter the location. An optional deprecation message can be specified after the directive.

# Limited Directives

The following directives (generally speaking) only make sense when applied to certain kinds of resources, as opposed to any arbitrary resource. For example, `@context` can describe functions, predicates, and loot tables (among others), but it is meaningless to speak of `@context` for a block tag or a trim material. Some are even stricter, like `@returns`, which only makes sense for functions. 

## @context

This directive specifies what execution context (i.e. entity, position, rotation, dimension, etc.) the resource is expected to be called with. Different resource types may have different options for what can be specified for the context.

The first value is either a human readable description of the intended context, or it is a special `@` keyword for well-known contexts.

### Well known contexts

* @context @root: The server root, as in default for commands.  
* @context @any: Any context, this is the default if the context isn't specified at all. Can be used to explicitly state that context is unimportant, but isn't strictly necessary

### Custom contexts

@context <description>  
  (@<context_part> <value>)*

Custom contexts allow you to specify specific requirements for the context, including a human readable description. The available context parts and their associated values depend on the specific resource type being documented. **TODO: specify the exact options for each resource type**

For example:

| > game:give_winner_prizes   @context      the player/CPU-controlled entity that won the round     @entity any |
| :---- |

## @reads

This directive specifies data, such as scores and storage values, that the resource will attempt to read. The values may not have to exist, as this is more meant for global configuration type stuff. For more complicated structures, mcdoc is supported as follows. Multiple @reads directives can be used to specify multiple separate things being read.

| @reads <specifier>   [<description>]   [<subdirectives...>] |
| :---- |

The specifier determines what kind of data is being read (score/storage) and where it is being read from.  
The description is an optional human-readable description of what is being read, and only applies to this specific case, with the description of the underlying type/data is included automatically in addition to the description specified here.  
The subdirectives can be used to further document the details of what is being read.

| > foo:bar  Foos the bar with the baz  @reads storage foo:bar path.to.value   @type struct {     /// The baz     baz: int,      xyzzy: [struct {       /// A var of the xyzzy       var: int,        /// The blah of the xyzzy       blah: string     }]   } |
| :---- |

@reads, @input, and @writes are the replacement for `#declare` from previous versions of IMP Doc, analyzers are expected to be able to use these directives to determine the types and existence of data that it is unable to determine through other means.

The available specifiers are similar to what is available in **execute** **store**:

### Block

**TODO: All block state, or only block NBT?**

### Bossbar

**TODO**

### Entity

**TODO: Selector stuff, or only entity NBT?**

### Score

Follows the same format as the `score` doc resource specifier. 

| @reads score <holder> <objective>   [<description>]   [<subdirectives...>] |
| :---- |

Example:

| @reads score @s foo.bar   How many bar to do   @type int @ 0..10 |
| :---- |

### Storage

| @reads storage <id> [<path>]   [<description>]   [<subdirectives...>] |
| :---- |

Example:

| @reads storage foo:bar path.to.value   The stuff being read from this funny storage   @type struct {     /// The baz     baz: int,      xyzzy: [struct {       /// A var of the xyzzy       var: int,        /// The blah of the xyzzy       blah: string     }]   } |
| :---- |

## @input

This directive specifies data, such as scores, storage values, or macro parameters, that the resource takes as input and so must be set before calling. @input is stricter than @reads as it is intended specifically for things that act like parameters to a function call in other languages, and unlike @reads it also supports macro parameters. Similar to @reads the types of the inputs are specified in mcdoc format.

Multiple @input directives can be used to specify multiple separate forms of inputs.

| @input <specifier>   [<description>]   [<subdirectives...>] |
| :---- |

The available specifiers are the same @reads, with the addition of macros

| @input storage foo:bar path.to.value   @type struct {     /// The baz     baz: int,      xyzzy: [struct {       /// A var of the xyzzy       var: int,        /// The blah of the xyzzy       blah: string     }]   } @input score @s foo.bar   @type int @ 0..10 @input macro {   /// Docs for stuff   stuff: string } |
| :---- |

@reads, @input, and @writes are the replacement for `#declare` from previous versions of IMP Doc, analyzers are expected to be able to use these directives to determine the types and existence of data that they are unable to determine through other means.

### Macro

| @input macro <type> |
| :---- |

Specifies the macro parameters to the function.  
Since macro parameters must be an NBT compound with a fixed set of keys, the mcdoc type must evaluate to a struct under all cases, and any macro parameters inside the function must be available under all cases (i.e. must be the common keys across all union cases, i.e. the intersection of the set of keys).  
If the type is a union (after evaluating annotations), any keys that are not common across all cases are automatically marked as optional in the context of the macro, as the function will be unable to use them anyway.

Due to how common it is to specify the macro inline, the struct keyword is optional and the braces are assumed to indicate a struct body.

Example:

| @input macro {   /// Docs for stuff   stuff: string } |
| :---- |

## @writes

This directive specifies any sort of data that is modified during the course of the function, whether as part of the primary functionality or a side effect.

| @writes <specifier>   [<description>]   [<subdirectives...>] |
| :---- |

The available specifiers are the same as @reads

@reads, @input, and @writes are the replacement for `#declare` from previous versions of IMP Doc, analyzers are expected to be able to use these directives to determine the types and existence of data that they are unable to determine through other means.

## @returns

This directive specifies the value this function returns using the `return` command, and can further be split into `success`, `result`, and `void`. For example:

| @returns   @result     The distance (in blocks, rounded up) before an obstacle is hit, 0 if no block or entity is found     @type int @ 0..   @success     @type enum(int) {       /// Nothing was hit       MISS = 0,       /// A block or entity was hit       HIT = 1     }   @void The inputs are badly formatted |
| :---- |

Note that this directive is NOT for scores or other values that are used as output, only the literal `return` command. For those types of output, see @writes.

The `void` case occurs if the function doesn't run the `return` command at all

## @handles

This directive is used to specify the resources that handle/call this resource. Most commonly, this is used to explicitly specify that this gets called dynamically from a macro, by a function tag, or by an advancement reward. This is most valuable in cases where static analyzers are not able to locate the uses of this resource, like from a macro.

When specifying only a single handler resource, the directive can be written on a single line, but if there are multiple the individual resources must be listed on separate lines, with at least one indentation whitespace (spaces/horizontal tabs).

@handles <doc resource specifier>

## @type

This directive is used to specify the mcdoc type of the resource. Only applicable to resources that represent some form of data, e.g. scores/objectives or storage  
@type enum(int) {  
  /// Gamma corrected RGB  
  SRGB = 0,  
     
  /// Linear RGB  
  RGB = 1,  

  /// Perceptual oklab colour  
  OKLAB = 2,  
}
