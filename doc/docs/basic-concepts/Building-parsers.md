### Overview

**The `peg` tag accepts any valid Pegase expression and always returns a `Parser` instance.**

Pegase parsers follow the *combinator* paradigm: simple parsers are combined to form more complex parsers. You can read more about it in the [API > `Parser`](/pegase/api/Parser/) section. In the following table are the different expressions you can use as building blocks (`a` and `b` representing any peg expression of higher precedence):

<table>
  <thead>
    <tr>
      <th>Pegase</th>
      <th>Description</th>
      <th>Children</th>
      <th>Precedence</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><pre>.</pre></td>
      <td>Matches any character</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="16">0</td>
    </tr>
    <tr>
      <td><pre>$</pre></td>
      <td>Matches the end of the input (equivalent to <code>!. @token("end of input")</code>)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>ε</pre></td>
      <td>Matches the empty string. Equivalent to <code>''</code> and always a success.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>^</pre></td>
      <td>The cut operator. Always a success, commits to an alternative to prevent exploring any further in an ordered choice expression. Example : <code>'x' ^ a &#124; b</code> will <b>not</b> try <code>b</code> if <code>'x'</code> was found but <code>a</code> failed.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>(a)</pre></td>
      <td>Matches <code>a</code></td>
      <td>Forwarded from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>>id<</pre></td>
      <td>Back reference. Matches the string literal captured as <code>id</code>.</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>@@dir<br/>@${func}<br/>@ => 'label'</pre>etc.</td>
      <td>Syntactic sugar for directives applied to the empty literal parser: <code>'' @dir</code>, <code>'' ${func}</code>, etc. Handy if you don't care about a directive's wrapped parser.</td>
      <td>Directives generate new parsers. So <code>children</code> depends on whatever parser is generated.</td>
    </tr>
    <tr>
      <td><pre>identifier</pre></td>
      <td>Matches the non-terminal <code>identifier</code></td>
      <td>Forwarded from the non-terminal <code>identifier</code></td>
    </tr>
    <tr>
      <td><pre>'literal'</pre></td>
      <td>Matches the string <i>"literal"</i></td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>"literal"</pre></td>
      <td>Matches the string <i>"literal"</i></td>
      <td><code>["literal"]</code></td>
    </tr>
    <tr>
      <td><pre>42</pre></td>
      <td>Matches the number literally (equivalent to <code>'42'</code>)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>${arg}</pre></td>
      <td>Template tag argument (<code>arg</code> is a JS expression). It can be a number (matches the number literally), a string (matches the string), a <code>RegExp</code> (matches the regular expression), or a <code>Parser</code> instance. Plugins can add support for additionnal values.</td>
      <td>If <code>arg</code> is a string or a number: <code>[]</code>. If <code>arg</code> is a <code>RegExp</code>, it emits its capturing groups (if any). If <code>arg</code> is a <code>Parser</code> instance, its children are forwarded.</td>
    </tr>
    <tr>
      <td><pre>[a-zA-Z]</pre></td>
      <td>Matches one character in the given character class (same syntax as <code>RegExp</code> character classes)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>[^a-zA-Z]</pre></td>
      <td>Matches one character <b>not</b> in the given character class (same syntax as <code>RegExp</code> negated character classes)</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>\n<br/>\s<br/>\xAF<br/>\uA6F1</pre>etc.</td>
      <td>Matches the escaped metacharacter as a <code>RegExp</code> expression (i.e. <code>\s</code> matches any whitespace, <code>\S</code> any non-whitespace, <code>\uA6F1</code> matches the unicode character <code>A6F1</code>, etc. (<a href="https://www.w3schools.com/jsref/jsref_obj_regexp.asp">See <code>RegExp</code> documentation</a> for a complete list of supported metacharacters).</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>/ab/<br/>/\w+/<br/>/(\d+):(\d+)/</pre>etc.</td>
      <td>Matches the regex (same syntax as JS' <code>RegExp</code> literals)</td>
      <td>The regex's capturing groups</td>
    </tr>
    <tr>
      <td><pre>a?</pre></td>
      <td>Matches zero or one <code>a</code></td>
      <td>Forwarded from <code>a</code></td>
      <td align="center" rowspan="6">1</td>
    </tr>
    <tr>
      <td><pre>a+</pre></td>
      <td>Matches one or more <code>a</code></td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a*</pre></td>
      <td>Matches zero or more <code>a</code></td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4}</pre></td>
      <td>Matches <code>a</code> exactly 4 times. Please note that quantifiers can be parametrized by tag argument: <code>a{${n}}</code>, where <code>n</code> is a JS expression.</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4, 15}</pre></td>
      <td>Matches <code>a</code> between 4 and 15 times</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a{4,}</pre></td>
      <td>Matches <code>a</code> at least 4 times</td>
      <td>Forwarded and concatenated from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>&amp;a</pre></td>
      <td>Matches <code>a</code> without consuming any input</td>
      <td><code>[]</code></td>
      <td align="center" rowspan="2">2</td>
    </tr>
    <tr>
      <td><pre>!a</pre></td>
      <td>Succeeds if <code>a</code> fails and vice-versa, doesn't consume input</td>
      <td><code>[]</code></td>
    </tr>
    <tr>
      <td><pre>&lt;id&gt;a</pre></td>
      <td>If <code>a</code> emits a single child (called <i>value of <code>a</code></i>), it's captured and assigned to the identifier <i>"id"</i>, which can then be used in semantic actions and back references. Otherwise, <i>"id"</i> will be set to <code>undefined</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center" rowspan="4">3</td>
    </tr>
    <tr>
      <td><pre>&lt;&gt;id</pre></td>
      <td>Shortcut for <code>&lt;id&gt;id</code>, where <code>id</code> is a non-terminal</td>
      <td>Forwarded from the non-terminal <code>id</code></td>
    </tr>
    <tr>
      <td><pre>&lt;...id&gt;a</pre></td>
      <td>Captures the children of <code>a</code> and assigns them to the identifier <i>"id"</i> as an array</td>
      <td>Forwarded from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>&lt;...&gt;id</pre></td>
      <td>Shortcut for <code>&lt;...id&gt;id</code>, where <code>id</code> is a non-terminal</td>
      <td>Forwarded from the non-terminal <code>id</code></td>
    </tr>
    <tr>
      <td><pre>...a</pre></td>
      <td>Skips input character by character until <code>a</code> is matched. This can be used to implement <i>synchronization</i> to recover from errors and is equivalent to <code>(!a .)* a</code>. Write <code>...&amp;a</code> if you want to sync to <code>a</code> without consuming <code>a</code>. See <a href="#failure-recovery">Failure recovery</a>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">4</td>
    </tr>
    <tr>
      <td><pre>a % b<br/>a %? b<br/>a %{3} b<br/>a %{3,} b</pre>etc.</td>
      <td>Matches a sequence of <code>a</code> separated by <code>b</code>. The <code>%</code> operator can be parametrized using the quantifiers described above. <code>a % b</code> is equivalent to <code>a (b a)*</code>, <code>a %? b</code> to <code>a (b a)?</code>, etc.</td>
      <td>Forwarded and concatenated from the matched sequence of <code>a</code> and <code>b</code></td>
      <td align="center">5</td>
    </tr>
    <tr>
      <td><pre>a - b</pre></td>
      <td>Matches <code>a</code> but not <code>b</code> (fails if <code>b</code> succeeds). Equivalent to <code>!b a</code>.</td>
      <td>Forwarded from <code>a</code></td>
      <td align="center">6</td>
    </tr>
    <tr>
      <td><pre>a b</pre></td>
      <td>Matches <code>a</code> followed by <code>b</code></td>
      <td>Forwarded and concatenated from <code>a</code> and <code>b</code></td>
      <td align="center">7</td>
    </tr>
    <tr>
      <td><pre>a @dir<br/>a @dir(x, y)<br/>a @dir(x, ${y})<br/>a @dir @other</pre>etc.</td>
      <td>Applies the directive(s) to the parser <code>a</code>. Directives are functions that take a parser and return a new parser. They can take additional arguments and can be chained.</td>
      <td>Directives generate new parsers. So <code>children</code> depends on whatever parser is generated.</td>
      <td align="center" rowspan="3">8</td>
    </tr>
    <tr>
      <td><pre>a ${func}</pre></td>
      <td>Semantic action. <code>func</code> is a JS function passed as tag argument. It will be called if <code>a</code> succeeds and will receive <code>a</code>'s captures as a single object argument. This is in fact a shortcut for <code>a @action(${func})</code> and can thus be chained with other directives as described above.</td>
      <td><code>[&lt;return value of func&gt;]</code> if that value is different than <code>undefined</code>, otherwise forwarded from <code>a</code></td>
    </tr>
    <tr>
      <td><pre>a => 'label'</pre></td>
      <td>Shortcut for <code>a @node('label')</code>. It will generate a Pegase node labeled <i>"label"</i> and emit it as a single child. See <a href="#ast-and-visitors">AST and visitors</a>. The label value can be inserted via tag argument: <code>a => ${str}</code>, where <code>str</code> is a JS string.</td>
      <td><code>[&lt;the generated node&gt;]</code></td>
    </tr>
    <tr>
      <td><pre>a | b</pre></td>
      <td>Ordered choice. Succeeds if <code>a</code> or <code>b</code> succeeds (order matters). Please note that you can add a leading bar for aesthetic purposes.</td>
      <td>Forwarded from <code>a</code> or <code>b</code></td>
      <td align="center">9</td>
    </tr>
    <tr>
      <td><pre>id: a<br/>$id: a</br/>id @dir: a<br/>id(x, y): a<br/>id(p = \d): a</pre>etc.</td>
      <td>Rule. This creates a non-terminal <code>id</code> as an alias to parser <code>a</code>. Rules can be stacked to form <b>grammars</b>. If directives are specified right after the rule name, they are applied to the whole right-side expression <code>a</code>. Adding <code>$</code> at the beginning of a rule name applies an implicit <code>@token</code> directive (the display name in failure reports will be the rule name transformed to space case, i.e. <code>$myToken: a</code> is equivalent to <code>myToken @token("my token"): a</code>).</td>
      <td>Forwarded from the topmost rule</td>
      <td align="center">10</td>
    </tr>
  </tbody>
</table>

