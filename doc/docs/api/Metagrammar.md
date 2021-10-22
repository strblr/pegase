This is the peg expression of peg expressions.

```
# Main rules:

parser:
  grammarParser | optionsParser

grammarParser:
  (identifier ruleParameterDefinitions directives ':' ^ optionsParser)+

optionsParser:
  '|'? directiveParser % '|'

directiveParser:
  sequenceParser directives

sequenceParser:
  minusParser+

minusParser:
  moduloParser % '-'

moduloParser:
  forwardParser % ('%' repetitionRange?)

forwardParser:
  '...'? captureParser

captureParser:
  ('<' '...'? identifier? '>')? predicateParser

predicateParser:
  ('&' | '!')? repetitionParser

repetitionParser:
  primaryParser repetitionRange?

primaryParser:
| '.'
| '$' - identifier
| 'ε'
| '^'
| '(' ^ optionsParser ')'
| '>' ^ identifier '<'
| '@' ^ directive
| !(identifier ruleParameterDefinitions directives ':') nonTerminal
| numberLiteral
| stringLiteral
| characterClass
| escapedMeta
| regexLiteral
| castableTagArgument


# Secondary rules:

nonTerminal:
  identifier ruleParameters

repetitionRange:
| '?'
| '+'
| '*'
| '{' value (',' value?)? '}'

ruleParameterDefinitions:
  ('(' (identifier ('=' optionsParser)?) % ',' ')')?

ruleParameters:
  ('(' optionsParser? % ',' ')')?

directives:
  directive*

directive:
| '@' ^ identifier directiveParameters
| actionTagArgument
| '=>' value

directiveParameters:
  ('(' value % ',' ')')?

value:
| tagArgument
| stringLiteral
| numberLiteral
| nonTerminal
| characterClass
| escapedMeta
| regexLiteral


# Tokens:

identifier @token('identifier'):
  /(\$?[_a-zA-Z][_a-zA-Z0-9]*)/

numberLiteral @token('number literal'):
  /[0-9]+\.?[0-9]* /

stringLiteral @token('string literal'):
| /'((?:[^\\']|\\.)*)'/
| /"(?:[^\\"]|\\.)*"/

regexLiteral @token('regex literal'):
  /\/((?:\[[^\]]*]|[^\\\/]|\\.)+)\//

characterClass @token('character class'):
  /\[(?:[^\\\]]|\\.)*]/

escapedMeta @token('escaped metacharacter'):
  /\\[a-zA-Z0-9]+/

tagArgument @token('tag argument'):
  /~(\d+)/

castableTagArgument @token('castable tag argument'):
  tagArgument

actionTagArgument @token('action tag argument'):
  tagArgument
```